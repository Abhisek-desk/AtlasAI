import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";

dotenv.config({ override: true });

const port = process.env.PORT;
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Auth service is running" });
});

app.listen(port, () => {
  console.log(`Auth Server started at ${port}`);
  console.log(
    `INTERNAL_API_SECRET ${process.env.INTERNAL_API_SECRET ? "is set" : "is MISSING"}`,
  );
  connectDB();
});