import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import router from "./routes/agent.route.js";

dotenv.config({ override: true });

const port = process.env.PORT;

const app = express();
app.use(express.json());
app.use("/agent", router);

app.get("/", (req, res) => {
  res.json({ message: "Agent service is running" });
});

// Must come after the routes so it catches their errors.
app.use((err, req, res, next) => {
  console.error(err.status ? `${err.status}:` : "Agent error:", err.data || err.message);

  if (err.status) {
    return res.status(err.status).json(err.data);
  }
  return res.status(500).json({ message: `agent error ${err}` });
});

app.listen(port, () => {
  console.log(`Agent Server started at ${port}`);
  console.log(
    `INTERNAL_API_SECRET ${process.env.INTERNAL_API_SECRET ? "is set" : "is MISSING"}`,
  );
  connectDB();
});