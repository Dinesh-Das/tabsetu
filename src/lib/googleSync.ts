/**
 * Google Drive appDataFolder sync helpers using cross-browser WebExtension OAuth.
 */
import type { StorageData } from "@/types";
import { getOAuthRedirectUrl, hasIdentityApi, launchOAuthFlow } from "@/lib/browserCompat";
import { removeOptionalPermission, requestOptionalPermission } from "@/lib/optionalPermissions";

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
  version?: string;
}

interface DriveFilesResponse {
  files?: DriveFile[];
}

export interface DriveSyncSnapshot {
  data: Partial<StorageData>;
  fileId: string;
  etag: string | null;
  version: string | null;
}

export interface DriveSyncVersion {
  fileId: string;
  etag: string | null;
  version: string | null;
}

export class GoogleDriveSyncError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "GoogleDriveSyncError";
  }

  get isConflict(): boolean {
    return this.status === 409 || this.status === 412;
  }
}

interface UserInfoResponse {
  email?: string;
}

interface TokenEndpointResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

declare const __TABSETU_GOOGLE_CLIENT_ID__: string | undefined;
declare const __TABSETU_GOOGLE_SCOPES__: string[] | undefined;

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

function getOAuthConfig(): { clientId: string; scopes: string[] } | null {
  const manifest = chrome.runtime.getManifest();
  const oauth2 = manifest.oauth2;
  const manifestClientId =
    oauth2?.client_id && oauth2.client_id !== "__REPLACE_WITH_CLIENT_ID__" ? oauth2.client_id : "";
  const buildClientId =
    typeof __TABSETU_GOOGLE_CLIENT_ID__ === "string" ? __TABSETU_GOOGLE_CLIENT_ID__.trim() : "";
  const clientId = manifestClientId || buildClientId;

  if (!clientId) {
    return null;
  }

  const buildScopes =
    typeof __TABSETU_GOOGLE_SCOPES__ !== "undefined" && Array.isArray(__TABSETU_GOOGLE_SCOPES__)
      ? __TABSETU_GOOGLE_SCOPES__
      : [];
  const scopes = oauth2?.scopes?.length
    ? oauth2.scopes
    : buildScopes.length
      ? buildScopes
      : [
          "https://www.googleapis.com/auth/drive.appdata",
          "https://www.googleapis.com/auth/userinfo.email",
        ];

  return { clientId, scopes };
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
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function storageRemoveToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([TOKEN_STORAGE_KEY], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function buildAuthRequest(
  interactive: boolean,
  state: string
): Promise<{ authUrl: string; codeVerifier: string; redirectUri: string } | null> {
  const config = getOAuthConfig();
  const redirectUri = getOAuthRedirectUrl(REDIRECT_PATH);
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

  const redirectUrl = await launchOAuthFlow(authRequest.authUrl, interactive);
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

async function requireOkResponse(response: Response | null, operation: string): Promise<Response> {
  if (!response) {
    throw new GoogleDriveSyncError(
      `${operation} failed. Check your Google connection and sign in again.`
    );
  }

  if (response.ok) {
    return response;
  }

  const body = await response.text().catch(() => "");
  const detail = body.trim().slice(0, 240);
  throw new GoogleDriveSyncError(
    `${operation} failed (${response.status}).${detail ? ` ${detail}` : ""}`,
    response.status
  );
}

async function findSyncFile(token: string): Promise<DriveFile | null> {
  const query = encodeURIComponent(
    `name = '${SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime,version)");
  const response = await requireOkResponse(
    await authedFetch(token, `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=${fields}`),
    "Google Drive file lookup"
  );

  try {
    const body: unknown = await response.json();
    if (!isDriveFilesResponse(body)) {
      throw new GoogleDriveSyncError("Google Drive returned an invalid file-list response.");
    }

    return body.files?.find(isDriveFile) ?? null;
  } catch (error) {
    if (error instanceof GoogleDriveSyncError) throw error;
    throw new GoogleDriveSyncError("Google Drive returned an unreadable file-list response.");
  }
}

/**
 * Opens the Google account consent flow and returns an OAuth access token, or null on failure.
 */
export async function signIn(): Promise<string | null> {
  if (hasIdentityApi() && !(await requestOptionalPermission("identity"))) {
    return null;
  }

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
  await removeOptionalPermission("identity");
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
export async function uploadSync(
  data: StorageData,
  options: { expectedRemote?: DriveSyncVersion | null } = {}
): Promise<void> {
  const token = await getSilentToken();
  if (!token) {
    throw new Error("Google Drive authorization is unavailable. Reconnect sync and try again.");
  }

  const existing = await findSyncFile(token);
  const body = JSON.stringify(data);

  if (existing) {
    if (options.expectedRemote === null) {
      throw new GoogleDriveSyncError(
        "The Google Drive backup changed during sync. TabSetu will merge it before uploading.",
        409
      );
    }
    if (options.expectedRemote && options.expectedRemote.fileId !== existing.id) {
      throw new GoogleDriveSyncError(
        "The Google Drive backup was replaced during sync. TabSetu will merge it before uploading.",
        409
      );
    }
    if (options.expectedRemote?.version && existing.version !== options.expectedRemote.version) {
      throw new GoogleDriveSyncError(
        "The Google Drive backup changed during sync. TabSetu will merge it before uploading.",
        409
      );
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    if (options.expectedRemote?.etag) {
      headers.set("If-Match", options.expectedRemote.etag);
    }
    await requireOkResponse(
      await authedFetch(
        token,
        `${DRIVE_UPLOAD_URL}/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,modifiedTime`,
        {
          method: "PATCH",
          headers,
          body,
        }
      ),
      "Google Drive upload"
    );
    return;
  }

  if (options.expectedRemote) {
    throw new GoogleDriveSyncError(
      "The Google Drive backup was removed during sync. TabSetu will check it again.",
      409
    );
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

  await requireOkResponse(
    await authedFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    }),
    "Google Drive upload"
  );
}

/**
 * Downloads the TabSetu storage snapshot from Drive appDataFolder.
 */
export async function downloadSync(): Promise<DriveSyncSnapshot | null> {
  const token = await getSilentToken();
  if (!token) {
    throw new Error("Google Drive authorization is unavailable. Reconnect sync and try again.");
  }

  const existing = await findSyncFile(token);
  if (!existing) {
    return null;
  }

  const response = await requireOkResponse(
    await authedFetch(token, `${DRIVE_FILES_URL}/${encodeURIComponent(existing.id)}?alt=media`),
    "Google Drive download"
  );

  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new GoogleDriveSyncError("The Google Drive backup has an invalid format.");
    }
    return {
      data: body,
      fileId: existing.id,
      etag: response.headers.get("etag"),
      version: existing.version ?? null,
    };
  } catch (error) {
    if (error instanceof GoogleDriveSyncError) throw error;
    throw new GoogleDriveSyncError("The Google Drive backup could not be read as JSON.");
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
