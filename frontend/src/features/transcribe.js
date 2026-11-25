import api from "../../utils/axios.js";

// File extension the server needs to recognise the audio format.
const extensionFor = (mimeType) => {
  const type = String(mimeType || "").toLowerCase();

  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";

  return "webm";
};

// Sends a recording to the server and returns the text that was spoken.
// Errors keep the server's message (error.response.data.message) so the voice
// input can show it, for example "out of credits" or "too many requests".
export const transcribeAudio = async (blob, language) => {
  const form = new FormData();

  form.append("audio", blob, `speech.${extensionFor(blob.type)}`);

  if (language) form.append("language", language);

  const { data } = await api.post("/api/agent/transcribe", form, {
    timeout: 45000,
  });

  return String(data?.text ?? "");
};