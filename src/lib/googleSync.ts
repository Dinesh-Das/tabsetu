/**
 * Google Drive appDataFolder sync helpers using cross-browser WebExtension OAuth.
 */
import type { StorageData } from "@/types";

const SYNC_FILE_NAME = "tabsetu-sync.json";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TOKEN_STORAGE_KEY = "TabSetu_google_oauth_token";
const REDIRECT_PATH = "google";
const TOKEN_EXPIRY_SKEW_MS = 60_000;

interface StoredToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

interface DriveFile {
  id: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files?: DriveFile[];
}

interface UserInfoResponse {
  email?: string;
}

interface TokenEndpointResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

type IdentityApi = typeof chrome.identity;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDriveFile(value: unknown): value is DriveFile {
  return isRecord(value) && typeof value.id === "string";
}

function isDriveFilesResponse(value: unknown): value is DriveFilesResponse {
  return isRecord(value) && (!("files" in value) || Array.isArray(value.files));
}

function isUserInfoResponse(value: unknown): value is UserInfoResponse {
  return isRecord(value) && (!("email" in value) || typeof value.email === "string");
}

function isStoredToken(value: unknown): value is StoredToken {
  return (
    isRecord(value) && typeof value.accessToken === "string" && typeof value.expiresAt === "number"
  );
}

function getIdentityApi(): IdentityApi | null {
  if (typeof chrome !== "undefined" && chrome.identity) {
    return chrome.identity;
  }

  return null;
}

function getOAuthConfig(): { clientId: string; scopes: string[] } | null {
  const manifest = chrome.runtime.getManifest();
  const oauth2 = manifest.oauth2;
  if (!oauth2?.client_id || oauth2.client_id === "__REPLACE_WITH_CLIENT_ID__") {
    return null;
  }

  const scopes = oauth2.scopes?.length
    ? oauth2.scopes
    : [
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/userinfo.email",
      ];

  return { clientId: oauth2.client_id, scopes };
}

function randomState(): string {
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBase64Url(byteLength: number): string {
  const values = new Uint8Array(byteLength);
  crypto.getRandomValues(values);
  return base64UrlEncode(values);
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBase64Url(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: base64UrlEncode(new Uint8Array(digest)),
  };
}

function isTokenEndpointResponse(value: unknown): value is TokenEndpointResponse {
  return (
    isRecord(value) &&
    typeof value.access_token === "string" &&
    typeof value.expires_in === "number" &&
    (!("refresh_token" in value) || typeof value.refresh_token === "string")
  );
}

function storageGetToken(): Promise<StoredToken | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([TOKEN_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      const token: unknown = result[TOKEN_STORAGE_KEY];
      resolve(isStoredToken(token) ? token : null);
    });
  });
}

function storageSetToken(token: StoredToken): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token }, () => resolve());
  });
}

function storageRemoveToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([TOKEN_STORAGE_KEY], () => resolve());
  });
}

function launchWebAuthFlow(url: string, interactive: boolean): Promise<string | null> {
  const identity = getIdentityApi();
  if (!identity) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      identity.launchWebAuthFlow({ url, interactive }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          resolve(null);
          return;
        }

        resolve(redirectUrl);
      });
    } catch {
      resolve(null);
    }
  });
}

function getRedirectUrl(): string | null {
  const identity = getIdentityApi();
  if (!identity) {
    return null;
  }

  try {
    return identity.getRedirectURL(REDIRECT_PATH);
  } catch {
    return null;
  }
}

async function buildAuthRequest(
  interactive: boolean,
  state: string
): Promise<{ authUrl: string; codeVerifier: string; redirectUri: string } | null> {
  const config = getOAuthConfig();
  const redirectUri = getRedirectUrl();
  if (!config || !redirectUri) {
    return null;
  }

  const pkce = await createPkcePair();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (!interactive) {
    url.searchParams.set("prompt", "none");
  }

  return { authUrl: url.toString(), codeVerifier: pkce.verifier, redirectUri };
}

function parseCodeFromRedirect(redirectUrl: string, expectedState: string): string | null {
  try {
    const url = new URL(redirectUrl);
    if (url.searchParams.get("state") !== expectedState) {
      return null;
    }

    return url.searchParams.get("code");
  } catch {
    return null;
  }
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<StoredToken | null> {
  const config = getOAuthConfig();
  if (!config) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    redirect_uri: redirectUri,
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      return null;
    }

    const json: unknown = await response.json();
    if (!isTokenEndpointResponse(json)) {
      return null;
    }

    return {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    };
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const config = getOAuthConfig();
  if (!config) {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      await storageRemoveToken();
      return null;
    }

    const json: unknown = await response.json();
    if (!isTokenEndpointResponse(json)) {
      await storageRemoveToken();
      return null;
    }

    const token: StoredToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
      refreshToken: json.refresh_token ?? refreshToken,
    };
    await storageSetToken(token);
    return token.accessToken;
  } catch {
    return null;
  }
}

async function requestToken(interactive: boolean): Promise<string | null> {
  const state = randomState();
  const authRequest = await buildAuthRequest(interactive, state);
  if (!authRequest) {
    return null;
  }

  const redirectUrl = await launchWebAuthFlow(authRequest.authUrl, interactive);
  if (!redirectUrl) {
    return null;
  }

  const code = parseCodeFromRedirect(redirectUrl, state);
  if (!code) {
    return null;
  }

  const token = await exchangeCodeForToken(code, authRequest.codeVerifier, authRequest.redirectUri);
  if (!token) {
    return null;
  }

  await storageSetToken(token);
  return token.accessToken;
}

async function getSilentToken(): Promise<string | null> {
  const stored = await storageGetToken();
  if (stored && stored.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now()) {
    return stored.accessToken;
  }

  if (stored?.refreshToken) {
    return refreshAccessToken(stored.refreshToken);
  }

  return null;
}

async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${TOKEN_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // Revocation is best effort; local token removal still signs the user out in TabSetu.
  }
}

async function authedFetch(
  token: string,
  url: string,
  init: RequestInit = {}
): Promise<Response | null> {
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      await storageRemoveToken();
      return null;
    }

    return response;
  } catch {
    return null;
  }
}

async function findSyncFile(token: string): Promise<DriveFile | null> {
  const query = encodeURIComponent(
    `name = '${SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const response = await authedFetch(
    token,
    `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=${fields}`
  );

  if (!response?.ok) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    if (!isDriveFilesResponse(body)) {
      return null;
    }

    return body.files?.find(isDriveFile) ?? null;
  } catch {
    return null;
  }
}

/**
 * Opens the Google account consent flow and returns an OAuth access token, or null on failure.
 */
export async function signIn(): Promise<string | null> {
  return requestToken(true);
}

/**
 * Returns whether TabSetu has or can silently obtain a valid OAuth access token.
 */
export async function hasSilentAuthToken(): Promise<boolean> {
  return (await getSilentToken()) !== null;
}

/**
 * Revokes and removes the current cached OAuth token if one exists.
 */
export async function signOut(): Promise<void> {
  const token = await storageGetToken();
  if (token) {
    await revokeToken(token.accessToken);
  }

  await storageRemoveToken();
}

/**
 * Reads the signed-in Google email with a silent token, or null if not signed in.
 */
export async function getSignedInEmail(): Promise<string | null> {
  const token = await getSilentToken();
  if (!token) {
    return null;
  }

  const response = await authedFetch(token, USERINFO_URL);
  if (!response?.ok) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    if (!isUserInfoResponse(body)) {
      return null;
    }

    return body.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Uploads a full TabSetu storage snapshot to Drive appDataFolder.
 */
export async function uploadSync(data: StorageData): Promise<void> {
  const token = await getSilentToken();
  if (!token) {
    return;
  }

  const existing = await findSyncFile(token);
  const body = JSON.stringify(data);

  if (existing) {
    await authedFetch(
      token,
      `${DRIVE_UPLOAD_URL}/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,modifiedTime`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }
    );
    return;
  }

  const boundary = `tabsetu-${Date.now()}`;
  const metadata = {
    name: SYNC_FILE_NAME,
    parents: ["appDataFolder"],
  };
  const multipartBody = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  await authedFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipartBody,
  });
}

/**
 * Downloads the TabSetu storage snapshot from Drive appDataFolder.
 */
export async function downloadSync(): Promise<Partial<StorageData> | null> {
  const token = await getSilentToken();
  if (!token) {
    return null;
  }

  const existing = await findSyncFile(token);
  if (!existing) {
    return null;
  }

  const response = await authedFetch(
    token,
    `${DRIVE_FILES_URL}/${encodeURIComponent(existing.id)}?alt=media`
  );

  if (!response?.ok) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * Returns the Drive sync file modified time as a Unix millisecond timestamp.
 */
export async function getLastSyncedAt(): Promise<number | null> {
  const token = await getSilentToken();
  if (!token) {
    return null;
  }

  const existing = await findSyncFile(token);
  if (!existing?.modifiedTime) {
    return null;
  }

  const timestamp = Date.parse(existing.modifiedTime);
  return Number.isFinite(timestamp) ? timestamp : null;
}
