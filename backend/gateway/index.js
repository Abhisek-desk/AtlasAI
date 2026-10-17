import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import router from "../services/auth/routes/auth.routes.js";
import cors from "cors";
import cookieParser from "cookie-parser"
dotenv.config();

const port = process.env.PORT;

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(cookieParser());

app.use("/auth",proxy(process.env.AUTH_SERVICE))
app.use("/",router)

app.get("/", (req, res) => {
  res.json({ message: "Gateway is running" });
});

app.listen(port, () => {
  console.log(`Gateway started at ${port}`);
});
