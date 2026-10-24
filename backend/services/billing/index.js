import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const port = process.env.PORT;
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Billing service is running" });
});

app.listen(port, () => {
  console.log(`Billing Server started at ${port}`);
  connectDB();
});