import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import chatRoutes from "./routes/chat.routes.js";

dotenv.config();

const port = process.env.PORT || 8002;
const app = express();

app.use(express.json());

app.use("/chat", chatRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Chat service is running" });
});

app.listen(port, () => {
  console.log(`Chat service started on port ${port}`);
  connectDB();
});