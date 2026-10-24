export const API_BASE = "http://localhost:3000";

let accessToken = null;
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token;
}

export async function restoreSession(signal) {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    setAccessToken(null);
    if (response.status === 401) return null;
    throw new Error(await responseError(response, "Unable to restore session"));
  }

  const session = await response.json();
  setAccessToken(session.accessToken);
  return session;
}

function refreshOnce(signal) {
  if (!refreshInFlight) {
    refreshInFlight = restoreSession(signal).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function send(path, options = {}) {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiRequest(path, options = {}) {
  let response = await send(path, options);

  const publicAuthEndpoint = [
    "/auth/login",
    "/auth/signup",
    "/auth/refresh",
  ].includes(path);
  if (response.status === 401 && !publicAuthEndpoint) {
    const session = await refreshOnce(options.signal);
    if (!session) {
      window.dispatchEvent(new Event("todo-auth-expired"));
      throw new Error("Your session expired. Please sign in again.");
    }
    response = await send(path, options);
  }

  return response;
}

export async function responseError(response, fallback) {
  try {
    const body = await response.json();
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message;
    if (typeof message === "string") return message;
  } catch {
    // The response may have no JSON body.
  }
  return `${fallback} (HTTP ${response.status}).`;
}
