// Big phone photos and screenshots are often 3-10 MB. Uploading that is the
// slowest part of "analyze this image", and the AI models don't need that many
// pixels. This shrinks them in the browser first.

const MAX_SIDE = 1800; // longest side, in pixels
const QUALITY = 0.85; // JPEG quality
const SKIP_BELOW_BYTES = 400 * 1024; // already small: leave as is

// New size that fits inside max x max while keeping the shape.
export const fitWithin = (width, height, max = MAX_SIDE) => {
  const scale = Math.min(1, max / Math.max(width, height));

  return {
    scale,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

// Returns a smaller JPEG File, or the original file if it is already small,
// can't be shrunk (GIF/SVG), or anything goes wrong.
export const shrinkImage = async (file) => {
  try {
    if (
      !file.type.startsWith("image/") ||
      /gif|svg/i.test(file.type) ||
      file.size < SKIP_BELOW_BYTES
    ) {
      return file;
    }

    // "from-image" applies the phone's rotation so photos aren't sideways.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const { width, height } = fitWithin(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    // JPEG has no transparency: paint white behind transparent PNGs.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    // Keep the original if shrinking didn't actually help.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("Could not shrink image, sending the original:", error);
    return file;
  }
};