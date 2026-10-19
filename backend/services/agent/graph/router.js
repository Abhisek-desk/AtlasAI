import { getModel } from "../config/llmModels.js";

export const router = async (state) => {
  const llm = await getModel("router");

  const prompt = `You are a router agent that routes the user query to the appropriate agent based on the query.
You have the following agents available:
- chat
- search
- coding
- pdf
- ppt
- vision

Rules for routing:
chat:
General queries, casual conversation, and questions that do not fit into the other categories.
search:
current events, news, or information that requires up-to-date knowledge.
coding:
general programming questions, code generation, debugging, and technical queries related to software development.
pdf:
Queries related to PDF documents, such as extracting information, summarizing content, or converting formats.
ppt:
Queries related to PowerPoint presentations, including creating slides, formatting, and content suggestions.
vision:
Queries related to computer vision tasks, image analysis, and visual data processing.

Return only one word:
chat 
search
coding
pdf
ppt
vision

User query:${state.prompt}

.

`;

const response = await llm.invoke(prompt)
console.log(response)

return{
    ...state,
    agent:response.content.trim().toLowerCase()
}
};
