import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getCurrentUser } from "./controllers/user.controller.js";
import protect, { requireCredits } from "./middleware/auth.middleware.js";
import { proxyWithHeader } from "./utils/proxyWithHeader.js";
import morgan from "morgan";
dotenv.config();

const port = process.env.PORT;

const app = express();
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
    ].filter(Boolean),
    credentials: true,
  }),
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
  "/api/agent",protect,requireCredits,
  proxyWithHeader(process.env.AGENT_SERVICE, {
    // express-http-proxy rejects bodies over 1mb by default; uploads can be 20mb.
    limit: "25mb",
    proxyReqPathResolver: (req) => `/agent${req.url}`,
  })
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
      headers["access-control-expose-headers"] = "content-disposition, content-type";
      return headers;
    },
  })
);

app.get("/api/me", protect, getCurrentUser);

app.get("/", (req, res) => {
  res.json({ message: "Gateway is running" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Gateway started at ${port}`);
});
