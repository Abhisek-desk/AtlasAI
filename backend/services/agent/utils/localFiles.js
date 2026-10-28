import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Generated PDFs, slides and images are kept here (inside the agent service)
// instead of in S3, and handed out as signed links that expire.
export const STORAGE_DIR = path.resolve("./generated");

// Links last 24 hours; files are removed after 48 so nothing piles up.
const MAX_FILE_AGE_MS = 48 * 60 * 60 * 1000;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

// Only plain file names with a known extension: no paths, no "..", no dotfiles.
export const isSafeName = (name) =>
  typeof name === "string" &&
  SAFE_NAME.test(name) &&
  !name.includes("..") &&
  Boolean(CONTENT_TYPES[path.extname(name).toLowerCase()]);

const getSecret = () => {
  const secret =
    process.env.FILE_SIGNING_SECRET || process.env.INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error(
      "Set FILE_SIGNING_SECRET in the agent service .env (any long random string)",
    );
  }

  return secret;
};

const sign = (filename, exp) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(`${filename}:${exp}`)
    .digest("hex");

const isValidSignature = (filename, exp, signature) => {
  const expected = Buffer.from(sign(filename, exp));
  const received = Buffer.from(String(signature || ""));

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};

const removeOldFiles = async () => {
  try {
    const names = await fs.readdir(STORAGE_DIR);

    await Promise.all(
      names.map(async (name) => {
        const filePath = path.join(STORAGE_DIR, name);
        const { mtimeMs } = await fs.stat(filePath);

        if (Date.now() - mtimeMs > MAX_FILE_AGE_MS) {
          await fs.unlink(filePath);
        }
      }),
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Generated files cleanup error:", error.message);
    }
  }
};

let cleanupStarted = false;

const startCleanup = () => {
  if (cleanupStarted) return;

  cleanupStarted = true;
  removeOldFiles();

  // unref: this timer must never keep the process alive on its own.
  setInterval(removeOldFiles, CLEANUP_EVERY_MS).unref?.();
};

export const saveFile = async (filename, buffer) => {
  if (!isSafeName(filename)) {
    throw new Error(`Unsafe or unsupported file name: ${filename}`);
  }

  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(STORAGE_DIR, filename), buffer);

  startCleanup();

  return filename;
};

// A link like https://gateway/api/files/name.pdf?exp=...&sig=...
export const createSignedUrl = (filename, expiresIn = 600) => {
  if (!isSafeName(filename)) {
    throw new Error(`Unsafe or unsupported file name: ${filename}`);
  }

  // Must be the address the BROWSER uses to reach the gateway.
  const baseUrl = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error(
      "Set PUBLIC_API_URL in the agent service .env (the gateway address, e.g. http://localhost:5000)",
    );
  }

  const exp = Math.floor(Date.now() / 1000) + expiresIn;

  return `${baseUrl}/api/files/${encodeURIComponent(filename)}?exp=${exp}&sig=${sign(filename, exp)}`;
};

// GET /agent/files/:filename?exp=...&sig=...
export const serveGeneratedFile = (req, res) => {
  const { filename } = req.params;
  const exp = String(req.query.exp || "");
  const sig = String(req.query.sig || "");

  if (!isSafeName(filename)) {
    return res.status(400).json({ message: "Invalid file name" });
  }

  let valid = false;

  try {
    valid = /^\d+$/.test(exp) && isValidSignature(filename, exp, sig);
  } catch (error) {
    console.error("File link check failed:", error.message);
    return res.status(500).json({ message: "File service is not configured" });
  }

  if (!valid) {
    return res.status(403).json({ message: "Invalid link" });
  }

  if (Number(exp) * 1000 < Date.now()) {
    return res.status(410).json({ message: "This link has expired" });
  }

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()];
  const isImage = contentType.startsWith("image/");

  return res.sendFile(
    path.join(STORAGE_DIR, filename),
    {
      headers: {
        "Content-Type": contentType,
        // Pictures show in the chat; PDFs and slides download.
        "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    },
    (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ message: "File not found (it may have expired)" });
      }
    },
  );
};