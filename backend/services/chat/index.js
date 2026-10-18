import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const port = process.env.PORT;

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Chart service is running" });
});

app.listen(port, () => {
  console.log(`chart Server started at ${port}`);
  connectDB();
});
