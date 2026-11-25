import express from "express"
import { agent } from "../controllers/agent.controller.js"
import { transcribe } from "../controllers/transcribe.controller.js"
import multer from "../config/multer.js"
import audioUpload from "../config/audioUpload.js"
import { serveGeneratedFile } from "../utils/localFiles.js"

const router = express.Router()

router.post("/chat", multer.single("file"), agent)

// Voice input: turns a short recording into text.
router.post("/transcribe", audioUpload.single("audio"), transcribe)

// Signed download links for generated PDFs, slides and images.
router.get("/files/:filename", serveGeneratedFile)

// Only upload problems (wrong type, too large) are handled here. Everything
// else (credit errors 402/403, rate limits 429, real bugs 500) goes on to the
// error handler in index.js so it keeps its real status.
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err?.status) return next(err)

  const isUploadError =
    err?.name === "MulterError" ||
    err?.isUpload === true ||
    err?.message === "Only PDF and Images are allowed"

  if (!isUploadError) return next(err)

  const tooLarge = err?.code === "LIMIT_FILE_SIZE"

  return res.status(tooLarge ? 413 : 400).json({
    message: tooLarge ? "File is too large" : err.message || "Upload failed",
  })
})

export default router