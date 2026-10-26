import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("./temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    // Keep the name readable but never trust it as a path.
    const safeName = path
      .basename(file.originalname)
      .replace(/[^\w.-]+/g, "_");

    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  // This used to be `file.mimetype = "application/pdf" || ...`, an assignment:
  // it accepted every file and rewrote its type to PDF.
  if (
    file.mimetype === "application/pdf" ||
    file.mimetype.startsWith("image/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Images are allowed"));
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});