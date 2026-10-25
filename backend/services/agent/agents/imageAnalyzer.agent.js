import { getModel } from "../config/llmModels.js";
import fs, { stat } from "fs";
export const imageAnalyzer = async (state) => {
  try {
    const llm = await getModel("imageAnalyzer");
    const imageBuffer = await fs.readFile(state.file.path);
    const base64Image=imageBuffer.toString("base64");
  } catch (error) {
    console.log(error)
  }
};
