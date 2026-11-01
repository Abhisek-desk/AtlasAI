import path from "node:path";
import { getCloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
// import { saveFile, createSignedUrl, getLinkTtlSeconds } from "./localFiles.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const uploadToCloudinary = (filename, buffer, conversationId) =>
  new Promise((resolve, reject) => {
    const ext = path.extname(filename).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext);

    const stream = getCloudinary().uploader.upload_stream(
      {
        // PDFs and slides are stored as "raw" files, pictures as images.
        resource_type: isImage ? "image" : "raw",
        folder: `atlasai/${conversationId || "misc"}`,
        // Raw files keep their extension in the URL; images get it from the format.
        public_id: isImage ? path.basename(filename, ext) : filename,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );

    stream.end(buffer);
  });

// Saves a generated file and returns what the chat needs to show and keep it.
//   { name, url, type, bytes, provider, publicId?, expiresInSeconds }
export const storeFile = async ({
  filename,
  buffer,
  contentType,
  conversationId,
}) => {
  if (isCloudinaryConfigured()) {
    const result = await uploadToCloudinary(filename, buffer, conversationId);

    return {
      name: filename,
      url: result.secure_url,
      type: contentType,
      bytes: result.bytes ?? buffer.length,
      provider: "cloudinary",
      publicId: result.public_id,
      expiresInSeconds: null,
    };
  }

  // Fallback: the old local generated/ folder with a signed, expiring link.
  await saveFile(filename, buffer);
  const ttl = getLinkTtlSeconds();

  return {
    name: filename,
    url: createSignedUrl(filename, ttl),
    type: contentType,
    bytes: buffer.length,
    provider: "local",
    expiresInSeconds: ttl,
  };
};

export const describeExpiry = (stored) => {
  if (!stored?.expiresInSeconds) {
    return "Saved to this chat. The link does not expire.";
  }

  const hours = Math.round(stored.expiresInSeconds / 3600);

  return hours <= 48
    ? `Link expires in ${hours} hrs`
    : `Link expires in ${Math.round(hours / 24)} days`;
};