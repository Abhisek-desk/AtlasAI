import { checkAgentLimit } from "../config/agentlimit.js";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-large-v3-turbo";

// Groq decides the audio format from the file name, so it needs the right
// extension.
const extensionFor = (mimeType) => {
  const type = String(mimeType || "").toLowerCase();

  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";

  return "webm";
};

// Turns a short voice recording into text with Groq Whisper.
// POST /agent/transcribe  (multipart: audio = the recording, language = "en")
export const transcribe = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];

    // Same per-minute limit as the other agents (throws a 429 error).
    await checkAgentLimit(userId, "transcribe");

    const audio = req.file;

    if (!audio?.buffer?.length) {
      return res.status(400).json({ message: "No audio was received." });
    }

    if (!process.env.GROQ_API_KEY) {
      return res
        .status(503)
        .json({ message: "Voice transcription is not set up on the server." });
    }

    const form = new FormData();

    form.append(
      "file",
      new Blob([audio.buffer], { type: audio.mimetype }),
      `speech.${extensionFor(audio.mimetype)}`,
    );
    form.append("model", process.env.GROQ_STT_MODEL || DEFAULT_MODEL);
    form.append("response_format", "json");
    form.append("temperature", "0");

    // A two-letter language code helps with accented speech.
    const language = String(req.body?.language || "").toLowerCase();

    if (/^[a-z]{2}$/.test(language)) {
      form.append("language", language);
    }

    let response;

    try {
      response = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      console.error("Transcription request failed:", error.message);

      return res.status(502).json({
        message: "The transcription service did not respond. Please try again.",
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");

      console.error(
        `Transcription failed (${response.status}):`,
        detail.slice(0, 300),
      );

      return res.status(502).json({
        message:
          response.status === 429
            ? "The transcription service is busy. Please try again in a moment."
            : "Transcription failed. Please try again.",
      });
    }

    const data = await response.json();

    return res.status(200).json({ text: String(data?.text ?? "").trim() });
  } catch (error) {
    // Rate-limit (429) errors keep their status through index.js.
    return next(error);
  }
};