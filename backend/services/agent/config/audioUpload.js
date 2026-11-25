import multer from "multer";

// Voice recordings for transcription. Kept in memory (they are small: about
// 0.5 MB for two minutes) and never written to disk.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  // Browsers label recordings audio/webm, audio/ogg, audio/mp4 (Safari) and
  // sometimes video/webm.
  if (/^(audio|video)\//.test(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new Error("Only audio recordings are allowed");
  error.isUpload = true; // lets the route's error handler answer with a 400
  cb(error);
};

export default multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
});