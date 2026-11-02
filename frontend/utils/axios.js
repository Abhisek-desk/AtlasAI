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

export default api;
