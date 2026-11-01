import express from "express"
import { agent } from "../controllers/agent.controller.js"
import multer from "../config/multer.js"
import { serveGeneratedFile } from "../utils/localFiles.js"

const router = express.Router()

router.post("/chat", multer.single("file"), agent)

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
    err?.message === "Only PDF and Images are allowed"

  if (!isUploadError) return next(err)

  const tooLarge = err?.code === "LIMIT_FILE_SIZE"

  return res.status(tooLarge ? 413 : 400).json({
    message: tooLarge ? "File is too large (max 20 MB)" : err.message || "Upload failed",
  })
})

export default router