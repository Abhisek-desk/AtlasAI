import express from "express"
import { agent } from "../controllers/agent.controller.js"
import multer from "../config/multer.js"

const router=express.Router()

router.post("/chat",multer.single("file"),agent)

// Upload problems (wrong type, too large) come back as JSON instead of an HTML page.
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err)

  const tooLarge = err?.code === "LIMIT_FILE_SIZE"

  return res.status(tooLarge ? 413 : 400).json({
    message: tooLarge ? "File is too large (max 20 MB)" : err?.message || "Upload failed",
  })
})

export default router