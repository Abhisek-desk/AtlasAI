// import axios from "axios";

// const api = axios.create({
//   baseURL: import.meta.env.VITE_SERVER_URL,
//   withCredentials: true,
// });

// export default api

import axios from "axios";

const SESSION_KEY = "atlas_session";

export const getStoredSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

// Pass a session ID to save it, or nothing/null to clear it (logout).
export const storeSession = (sessionId) => {
  try {
    if (sessionId) {
      localStorage.setItem(SESSION_KEY, sessionId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage can be blocked (private mode); the cookie is still tried.
  }
};

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:8000",
  withCredentials: true,
});

// Send the session on every request so login works even when the browser
// blocks cross-site cookies.
api.interceptors.request.use((config) => {
  const sessionId = getStoredSession();

  if (sessionId) {
    config.headers.Authorization = `Bearer ${sessionId}`;
  }

  return config;
});

// A sleeping free Render service answers 502/503/504 while it wakes up.
// Retry GET requests for those only, and never for 429 or network errors:
// retrying those just adds traffic and keeps the rate limit tripped.
const RETRY_STATUSES = [502, 503, 504];
const MAX_RETRIES = 2;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response?.status;
  const isGet = config?.method?.toLowerCase() === "get";

  if (!config || !isGet || !RETRY_STATUSES.includes(status)) {
    return Promise.reject(error);
  }

  config.__retryCount = (config.__retryCount || 0) + 1;

  if (config.__retryCount > MAX_RETRIES) {
    return Promise.reject(error);
  }

  await sleep(config.__retryCount * 5000);

  return api(config);
});

export default api;