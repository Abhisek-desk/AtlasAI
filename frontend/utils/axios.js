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

// Free Render services sleep when idle and answer 502/503/504 (or nothing at
// all) while they wake up. Retry GET requests a few times so the user does not
// see an error for a normal cold start.
const RETRY_STATUSES = [502, 503, 504];
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const isGet = config?.method?.toLowerCase() === "get";

  const retriable = error.response
    ? RETRY_STATUSES.includes(error.response.status)
    : error.code !== "ERR_CANCELED";

  if (!config || !isGet || !retriable) {
    return Promise.reject(error);
  }

  config.__retryCount = (config.__retryCount || 0) + 1;

  if (config.__retryCount > MAX_RETRIES) {
    return Promise.reject(error);
  }

  await sleep(config.__retryCount * 4000);

  return api(config);
});

export default api;