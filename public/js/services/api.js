import {
  STORAGE_KEY,
  state,
} from "../core/state.js";

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function setAccessToken(token) {
  state.accessToken = String(token ?? "").trim();

  if (state.accessToken) {
    localStorage.setItem(STORAGE_KEY, state.accessToken);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function rawRequest(path, options = {}) {
  const requestOptions = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { ...(options.headers ?? {}) },
  };

  if (options.body !== undefined) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }

  if (options.withAuth && state.accessToken) {
    requestOptions.headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const response = await fetch(path, requestOptions);
  const data = await parseResponse(response);
  return { response, data };
}

export async function refreshAccessToken() {
  const { response, data } = await rawRequest("/api/v1/auth/refresh-token", {
    method: "POST",
  });

  if (!response.ok || !data?.accessToken) {
    return false;
  }

  setAccessToken(data.accessToken);
  return true;
}

export async function authedRequest(path, options = {}, retryOnAuth = true) {
  if (!state.accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new Error("No active session. Please log in again.");
    }
  }

  let result = await rawRequest(path, { ...options, withAuth: true });

  if (result.response.status === 401 && retryOnAuth) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new Error("Your session expired. Please log in again.");
    }

    result = await rawRequest(path, { ...options, withAuth: true });
  }

  if (result.response.status === 403) {
    throw new Error(result.data?.message ?? "Administrator access required");
  }

  if (!result.response.ok) {
    throw new Error(
      result.data?.message ?? `Request failed with ${result.response.status}`,
    );
  }

  return result.data;
}
