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
const allowedOrigins = [
  "https://atlas-ai-psi-dun.vercel.app/",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as server-to-server calls.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  })
);


app.use(morgan("dev"));
app.use(cookieParser());

app.use(
  "/api/auth",
  proxy(process.env.AUTH_SERVICE, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  }),
);
app.use(
  "/api/chat",
  protect,
  proxyWithHeader(process.env.CHAT_SERVICE, {
    proxyReqPathResolver: (req) => `/chat${req.url}`,
  }),
);

app.use(
  "/api/agent",
  protect,
  requireCredits,
  proxyWithHeader(process.env.AGENT_SERVICE, {
    // express-http-proxy rejects bodies over 1mb by default; uploads can be 20mb.
    limit: "25mb",
    proxyReqPathResolver: (req) => `/agent${req.url}`,
  }),
);

app.use(
  "/api/billing",
  protect,
  proxyWithHeader(process.env.BILLING_SERVICE, {
    proxyReqPathResolver: (req) => `/billing${req.url}`,
  }),
);

app.use(
  "/api/files",
  proxy(process.env.AGENT_SERVICE, {
    // Do not buffer the file as JSON; PDF/PPT bytes must pass through as-is.
    parseReqBody: false,
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

app.get("/", (req, res) => {
  res.json({ message: "Gateway is running" });
});

app.listen(port, () => {
  console.log(`Gateway started at ${port}`);
});
