import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getCurrentUser } from "./controllers/user.controller.js";
import protect, { requireCredits } from "./middleware/auth.middleware.js";
import { proxyWithHeader } from "./utils/proxyWithHeader.js";
import morgan from "morgan";
dotenv.config({ override: true });

const port = process.env.PORT;

const app = express();

// Origins are compared exactly, so strip any trailing slash from every entry.
const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

// FRONTEND_URL can hold several addresses separated by commas.
const allowedOrigins = [
  ...String(process.env.FRONTEND_URL || "").split(","),
  "https://atlas-ai-psi-dun.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
]
  .map(normalizeOrigin)
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as server-to-server calls.
      if (!origin) return callback(null, true);

      // A blocked origin just gets no CORS headers. It must not throw,
      // because that turns into a 500 that hides the real problem.
      return callback(null, allowedOrigins.includes(normalizeOrigin(origin)));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  }),
);

app.use(morgan("dev"));
app.use(cookieParser());

// When a service is down or still waking up, answer with JSON instead of
// Render's HTML error page.
const upstreamErrorHandler = (serviceName) => (err, res, next) => {
  console.error(`${serviceName} service unreachable:`, err?.code || err?.message);

  if (res.headersSent) return next(err);

  return res.status(503).json({
    message: `${serviceName} service is unavailable. Please try again in a moment.`,
  });
};

const hideHtmlErrors =
  (serviceName) => (proxyRes, proxyResData, userReq, userRes) => {
    if (proxyRes.statusCode >= 502 && proxyRes.statusCode <= 504) {
      console.error(`${serviceName} service returned ${proxyRes.statusCode}`);

      userRes.set("Content-Type", "application/json; charset=utf-8");

      return JSON.stringify({
        message: `${serviceName} service is starting or unavailable. Please try again in a moment.`,
      });
    }

    return proxyResData;
  };

const serviceOptions = (serviceName, extra = {}) => ({
  // A sleeping Render service can take about a minute to wake up.
  timeout: 90000,
  proxyErrorHandler: upstreamErrorHandler(serviceName),
  userResDecorator: hideHtmlErrors(serviceName),
  ...extra,
});

app.use(
  "/api/auth",
  proxy(
    process.env.AUTH_SERVICE,
    serviceOptions("Auth", {
      proxyReqPathResolver: (req) => `/auth${req.url}`,
    }),
  ),
);

app.use(
  "/api/chat",
  protect,
  proxyWithHeader(
    process.env.CHAT_SERVICE,
    serviceOptions("Chat", {
      proxyReqPathResolver: (req) => `/chat${req.url}`,
    }),
  ),
);

app.use(
  "/api/agent",
  protect,
  requireCredits,
  proxyWithHeader(
    process.env.AGENT_SERVICE,
    serviceOptions("Agent", {
      // express-http-proxy rejects bodies over 1mb by default; uploads can be 20mb.
      limit: "25mb",
      // Model calls can be slow.
      timeout: 180000,
      proxyReqPathResolver: (req) => `/agent${req.url}`,
    }),
  ),
);

app.use(
  "/api/billing",
  protect,
  proxyWithHeader(
    process.env.BILLING_SERVICE,
    serviceOptions("Billing", {
      proxyReqPathResolver: (req) => `/billing${req.url}`,
    }),
  ),
);

app.use(
  "/api/files",
  proxy(process.env.AGENT_SERVICE, {
    // Do not buffer the file as JSON; PDF/PPT bytes must pass through as-is.
    parseReqBody: false,
    proxyErrorHandler: upstreamErrorHandler("Agent"),
    proxyReqPathResolver: (req) => {
      const original = req.originalUrl || req.url || "";
      const qIndex = original.indexOf("?");
      const pathname = qIndex === -1 ? original : original.slice(0, qIndex);
      const search = qIndex === -1 ? "" : original.slice(qIndex);
      const name = pathname.split("/").filter(Boolean).pop() || "";
      return `/agent/files/${name}${search}`;
    },
    userResHeaderDecorator: (headers) => {
      headers["access-control-expose-headers"] =
        "content-disposition, content-type";
      return headers;
    },
  }),
);

app.get("/api/me", protect, getCurrentUser);

// Open this URL in a browser to confirm which version Render is running.
app.get("/", (req, res) => {
  res.json({ message: "Gateway is running", version: "cors-fix-3" });
});

// Shows which service is down. It also wakes sleeping services, because each
// one gets a request.
app.get("/health", async (req, res) => {
  const targets = {
    auth: process.env.AUTH_SERVICE,
    chat: process.env.CHAT_SERVICE,
    agent: process.env.AGENT_SERVICE,
    billing: process.env.BILLING_SERVICE,
  };

  const services = {};

  await Promise.all(
    Object.entries(targets).map(async ([name, url]) => {
      const started = Date.now();

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(60000),
        });

        services[name] = {
          ok: response.ok,
          status: response.status,
          ms: Date.now() - started,
        };
      } catch (error) {
        services[name] = {
          ok: false,
          error: error.name === "TimeoutError" ? "timeout" : error.message,
          ms: Date.now() - started,
        };
      }
    }),
  );

  const allOk = Object.values(services).every((service) => service.ok);

  return res.status(allOk ? 200 : 503).json({ gateway: "ok", services });
});

// Last resort: any error becomes JSON. The cors middleware above has already
// added its headers, so the browser shows the real error instead of "CORS".
app.use((err, req, res, next) => {
  console.error("Gateway error:", err?.message || err);

  if (res.headersSent) return next(err);

  return res
    .status(err?.status || 500)
    .json({ message: err?.message || "Gateway error" });
});

app.listen(port, () => {
  console.log(`Gateway started at ${port}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});