import { getModel } from "../config/llmModels";

export const chatAgent = async (state) => {
  const llm =await getModel("chat");
  const systemPrompt =
    "You are Atlas AI, a large language model trained by OpenAI. You are a helpful assistant that can answer questions and provide information on a wide range of topics. Please provide a detailed and accurate response to the following prompt: ";
  const response = await llm.invoke([
    {
      "role": "system",
      "content": systemPrompt,
    },{
        "role":"human",
        "content":state.prompt
    }
  ]);
  return {
    ...state,
    aiResponse:response.content
  };
};
