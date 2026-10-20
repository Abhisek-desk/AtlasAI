import { getModel } from "../config/llmModels.js";

export const codingAgent = async (state) => {
  console.log("Coding agent started");

  try {
    const llm = await getModel("coding");

    console.log("Gemini model obtained. Sending prompt...");

    const response = await Promise.race([
      llm.invoke([
        {
          role: "system",
          content:
            "You are AtlasAI, an expert programming assistant. Answer clearly and accurately.",
        },
        {
          role: "human",
          content: state.prompt,
        },
      ]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini request timed out after 30 seconds")),
          30000
        )
      ),
    ]);
    return {
      ...state,
      aiResponse: response.content,
    };
  } catch (error) {
    console.error("Coding agent error:", error.message);
    throw error;
  }
};