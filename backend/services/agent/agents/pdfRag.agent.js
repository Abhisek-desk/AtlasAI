import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from "../config/vectorDb.js";
import { getModel } from "../config/llmModels.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import deductCredits from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentlimit.js";

// Short PDFs fit in the prompt, so they skip the vector database entirely
// (faster, cheaper, and no Qdrant or embeddings needed).
const DIRECT_CONTEXT_CHARS = 12000;

const toText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

export const pdfRag = async (state) => {
  const filePath = state.file?.path;
  let store = null;
  let collectionName = "";

  try {
    await checkAgentLimit(state.userId, "pdfRag");
    if (!filePath) {
      throw new Error("No PDF was uploaded");
    }

    const buffer = fs.readFileSync(filePath);
    const pdf = new PDFParse({
      data: buffer,
    });

    let text = "";

    try {
      const result = await pdf.getText();
      text = result.text || "";
    } finally {
      await pdf.destroy?.();
    }

    // Scanned PDFs contain pictures of text, not text.
    if (!text.trim()) {
      return {
        ...state,
        aiResponse:
          "I couldn't read any text in this PDF. It may be a scanned document or an image-only PDF.",
      };
    }

    let context = text;

    if (text.length > DIRECT_CONTEXT_CHARS) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([text]);
      collectionName = `pdf-${Date.now()}`;
      store = await vectorStore(docs, collectionName);

      const relevantDocs = await store.similaritySearch(state.prompt, 5);

      context = relevantDocs.map((d) => d.pageContent).join("\n\n");
    }

    const llm = await getModel("pdfRag");

    const messages = [
      new SystemMessage(`
        You are AtlasAI PDF assistant.
        Rules:
          - Answer ONLY from the uploaded PDF.
          - Never make up information
          - If the answer not present in the pdf, reply:"I couldn't find this information in the uploaded PDF"
          - Use Markdown formatting.
      `),
      new HumanMessage(
        `Context:${context},
        Question:${state.prompt}`,
      ),
    ];

    const response = await llm.invoke(messages);
    await deductCredits(state.userId, "pdf");
    return {
      ...state,
      aiResponse: toText(response.content),
    };
  } catch (error) {
    console.log(error);
    return {
      ...state,
      aiResponse: "Failed to analyze pdf",
    };
  } finally {
    // Temporary upload; also guard against a missing file.
    if (filePath) {
      fs.promises.unlink(filePath).catch(() => {});
    }

    // The collection belongs to this single question, so don't let them pile up.
    if (store && collectionName) {
      try {
        await store.client.deleteCollection(collectionName);
      } catch (cleanupError) {
        console.error(
          "Could not delete the PDF collection:",
          cleanupError.message,
        );
      }
    }
  }
};
