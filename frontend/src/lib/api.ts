// The one place that talks to the backend. Every screen uses `api` from here.
/* eslint-disable import/no-named-as-default-member -- axios.create / axios.isAxiosError are the documented way to call these */
import axios from 'axios';

import { API_URL } from './config';
import { clearTokens, getTokens, saveTokens } from './storage';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the login token (if the user is logged in) to every request.
api.interceptors.request.use(async (config) => {
  const { access } = await getTokens();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ---- Keeping the user logged in ----
// Access tokens are short-lived (30 minutes). When the backend says "401 unauthorised",
// we quietly swap the long-lived refresh token for a new access token and retry the request once.

let onAuthFailure: (() => void) | null = null;

// The login state calls this so it can send the user back to "logged out" if the refresh fails.
export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

// These calls are for people who are logging in, so they never need a token refresh.
const PUBLIC_PATHS = ['auth/otp', 'auth/login', 'auth/register', 'auth/token/refresh', 'auth/password/reset', 'auth/logout/'];

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;
  try {
    // A plain axios call, so this request does not trigger the interceptor again.
    const { data } = await axios.post<{ access: string; refresh?: string }>(
      `${API_URL}/auth/token/refresh/`,
      { refresh },
      { timeout: 15000 },
    );
    await saveTokens(data.access, data.refresh ?? refresh);
    return data.access;
  } catch (error) {
    // Only a clear "this token is no good" logs the user out. A network blip does not.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await clearTokens();
      onAuthFailure?.();
    }
    return null;
  }
}

const retried = new WeakSet<object>();

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';
    const isPublic = PUBLIC_PATHS.some((path) => url.includes(path));

    if (axios.isAxiosError(error) && error.response?.status === 401 && original && !isPublic && !retried.has(original)) {
      retried.add(original);
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

// ---- Errors ----
// The backend sends errors as { code, message, fields }.
export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

// Turns any error into a short message that is safe to show the user.
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Can't reach the server. Check your connection.";
    }
    const data = error.response.data as Partial<ApiError> | undefined;
    if (data?.message) {
      return data.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

// The backend's error code, such as 'invalid_otp' or 'account_exists'.
export function getErrorCode(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiError> | undefined;
    return data?.code ?? null;
  }
  return null;
}

// Field-by-field errors, for showing a message under the right input. { name: 'Name is required.' }
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (axios.isAxiosError(error)) {
    const fields = (error.response?.data as Partial<ApiError> | undefined)?.fields ?? {};
    for (const [key, messages] of Object.entries(fields)) {
      if (messages.length > 0) result[key] = messages[0];
    }
  }
  return result;
}
