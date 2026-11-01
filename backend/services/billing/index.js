import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import router from "./routes/billing.route.js";

dotenv.config({ override: true });

const port = process.env.PORT;
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Billing service is running" });
});

// The gateway forwards /api/billing/* as /billing/*
app.use("/billing", router);

app.listen(port, () => {
  console.log(`Billing Server started at ${port}`);
  console.log(
    `INTERNAL_API_SECRET ${process.env.INTERNAL_API_SECRET ? "is set" : "is MISSING"}`,
  );
  connectDB();
});