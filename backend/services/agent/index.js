import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import router from "./routes/agent.route.js";

dotenv.config();

const port = process.env.PORT;

const app = express();
app.use(express.json());
app.use("/agent", router);

app.use((err,req,res,next)=>{
  console.log(err)

  if(err.status){
    return res.status(err.status).json(err.data)
  }
  return res.status(500).json({message:`agent error ${err}`})
})

app.get("/", (req, res) => {
  res.json({ message: "Agent service is running" });
});

app.listen(port, () => {
  console.log(`Agent Server started at ${port}`);
  connectDB();
});
