import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

const port = process.env.PORT;
const app = express();

app.use(express.json());
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Auth service is running" });
});

app.listen(port, () => {
  console.log(`Auth Server started at ${port}`);
  connectDB();
});