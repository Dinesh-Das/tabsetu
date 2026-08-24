export type OptionalPermission = "history" | "notifications" | "identity" | "tabGroups";

function permissionDetails(permission: OptionalPermission): chrome.permissions.Permissions {
  return { permissions: [permission] };
}

export async function hasOptionalPermission(permission: OptionalPermission): Promise<boolean> {
  if (typeof chrome.permissions?.contains !== "function") {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.contains(permissionDetails(permission), (granted) => {
        resolve(Boolean(granted) && !chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

export function requestOptionalPermission(permission: OptionalPermission): Promise<boolean> {
  if (typeof chrome.permissions?.request !== "function") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.request(permissionDetails(permission), (granted) => {
        resolve(Boolean(granted) && !chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

export function removeOptionalPermission(permission: OptionalPermission): Promise<boolean> {
  if (typeof chrome.permissions?.remove !== "function") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      chrome.permissions.remove(permissionDetails(permission), (removed) => {
        resolve(Boolean(removed) && !chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}
