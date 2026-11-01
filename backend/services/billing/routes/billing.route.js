import express from "express";
import {
  createOrder,
  verifyPayment,
} from "../controllers/billing.controller.js";

const router = express.Router();
router.post("/create", createOrder);
router.post("/verify", verifyPayment);
router.get('/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath, {}, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).send("Error serving image");
      }
    });
  } else {
    res.status(404).send("Image not found");
  }
})

export default router
