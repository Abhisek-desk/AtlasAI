import { getModel } from "../config/llmModels.js";
import axios from "axios";
import { uploadToS3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import deductCredits from "../utils/deductCredits.js";

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

    const prompt = res.content.trim();

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    const imageRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    await deductCredits(state.userId,"vision")

    const buffer = Buffer.from(imageRes.data);
    const filename = `image-${Date.now()}.png`;

    await uploadToS3(filename, buffer, "image/png");

    const downloadUrl = await getFromS3(filename, 24*60);

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

