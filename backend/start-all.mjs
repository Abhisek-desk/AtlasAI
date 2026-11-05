// Runs the gateway and all four services inside ONE Render web service.
//
// Why: on Render's free plan, services calling each other through their public
// *.onrender.com addresses get rate limited (HTTP 429), and free services
// cannot receive private-network traffic. Here only the gateway is public;
// the other services listen on 127.0.0.1 inside the same container, so calls
// between them never leave the machine.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const PORTS = { auth: 8001, chat: 8002, agent: 8003, billing: 8004 };

// The services find each other through these (they override any env value).
const internalUrls = {
  AUTH_SERVICE: `http://127.0.0.1:${PORTS.auth}`,
  CHAT_SERVICE: `http://127.0.0.1:${PORTS.chat}`,
  AGENT_SERVICE: `http://127.0.0.1:${PORTS.agent}`,
  BILLING_SERVICE: `http://127.0.0.1:${PORTS.billing}`,
};

// heapMb caps each process's JavaScript memory so five processes fit together.
const services = [
  { name: "auth", dir: "services/auth", port: PORTS.auth, heapMb: 96 },
  { name: "chat", dir: "services/chat", port: PORTS.chat, heapMb: 96 },
  { name: "billing", dir: "services/billing", port: PORTS.billing, heapMb: 96 },
  { name: "agent", dir: "services/agent", port: PORTS.agent, heapMb: 192 },
  // The gateway is the only public one: it listens on Render's PORT.
  { name: "gateway", dir: "gateway", port: process.env.PORT || 10000, heapMb: 128 },
];

const buildEnv = (service) => {
  const env = {
    ...process.env,
    ...internalUrls,
    PORT: String(service.port),
    NODE_OPTIONS: `--max-old-space-size=${service.heapMb}`,
  };

  // If the services use different databases, set AUTH_MONGODB_URI,
  // CHAT_MONGODB_URI, AGENT_MONGODB_URI and BILLING_MONGODB_URI. Otherwise all
  // of them use MONGODB_URI.
  const own = process.env[`${service.name.toUpperCase()}_MONGODB_URI`];
  if (own) env.MONGODB_URI = own;

  return env;
};

const prefixLines = (stream, name, out) => {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) out.write(`[${name}] ${line}\n`);
  });

  stream.on("end", () => {
    if (buffer) out.write(`[${name}] ${buffer}\n`);
  });
};

const children = new Map();
const restarts = [];
let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) child.kill("SIGTERM");

  setTimeout(() => process.exit(code), 4000);
};

const start = (service) => {
  const child = spawn(process.execPath, ["index.js"], {
    cwd: path.join(root, service.dir),
    env: buildEnv(service),
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.set(service.name, child);
  prefixLines(child.stdout, service.name, process.stdout);
  prefixLines(child.stderr, service.name, process.stderr);

  child.on("exit", (code, signal) => {
    children.delete(service.name);
    if (shuttingDown) return;

    console.error(
      `[launcher] ${service.name} exited (code ${code}, signal ${signal})`,
    );

    // Too many crashes in a minute: stop, so Render restarts the container.
    const now = Date.now();
    restarts.push(now);
    while (restarts.length && now - restarts[0] > 60000) restarts.shift();

    if (restarts.length > 8) {
      console.error("[launcher] too many restarts, exiting");
      shutdown(1);
      return;
    }

    setTimeout(() => start(service), 3000);
  });
};

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

// Start one at a time: a free instance has very little CPU at boot.
services.forEach((service, index) => {
  setTimeout(() => start(service), index * 1500);
});

console.log(`[launcher] starting ${services.map((s) => s.name).join(", ")}`);