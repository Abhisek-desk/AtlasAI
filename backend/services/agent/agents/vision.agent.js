import { getModel } from "../config/llmModels.js";
import axios from "axios";
import { uploadToS3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import deductCredits from "../utils/deductCredits.js";

const toText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

export const visionAgent = async (state) => {
  try {
    const llm = await getModel("vision");

    const res = await llm.invoke(`
      You are an elite AI image prompt engineer.
      Convert the user request into a highly detailed image generation prompt.

      Requirements:
      - Cinematic lighting
      - Professional composition
      - Ultra realistic
      - High detail
      - Beautiful color palette
      - Sharp focus
      - 8K quality
      - Photorealistic
      - Depth of field
      - Professional photography
      - Stunning visuals

      Return only the image prompt.

      User Request:
      ${state.prompt}
    `);

    // Very long prompts make the URL too long for the image service.
    const prompt = toText(res.content).trim().slice(0, 600);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;

    const imageRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 120000,
    });

    // The service can answer 200 with an error page instead of a picture.
    const contentType = String(imageRes.headers["content-type"] || "image/png")
      .split(";")[0]
      .trim();

    if (!contentType.startsWith("image/")) {
      throw new Error(`Image service returned ${contentType}`);
    }

    const buffer = Buffer.from(imageRes.data);
    const extension = contentType.split("/")[1].replace("jpeg", "jpg");
    const filename = `image-${Date.now()}.${extension}`;

    await uploadToS3(filename, buffer, contentType);

    // 24 hours in seconds (it was 24 * 60 = 24 minutes).
    const downloadUrl = await getFromS3(filename, 24 * 60 * 60);

    // Charge only once the image really exists.
    await deductCredits(state.userId, "vision");

    return {
      ...state,
      aiResponse: `
# 🖼️ Image Generated Successfully!

![Generated Image](${downloadUrl})

⏳ The link expires in 24 hours, so download the image to keep it.
      `,
    };
  } catch (error) {
    console.error("Vision Agent Error:", error.message);

    return {
      ...state,
      aiResponse: "❌ Failed to generate image.",
    };
  }
};
