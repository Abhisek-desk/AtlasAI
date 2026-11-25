import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSpeechInput, getSpeechSupport } from "../../utils/speech.js";
import { transcribeAudio } from "../features/transcribe.js";

// To dictate in another language, run this once in the browser console and
// reload:  localStorage.setItem("atlas_speech_lang", "hi-IN")
const LANGUAGE_KEY = "atlas_speech_lang";

const getLanguage = () => {
  try {
    return (
      window.localStorage.getItem(LANGUAGE_KEY) ||
      window.navigator.language ||
      "en-US"
    );
  } catch {
    return window.navigator.language || "en-US";
  }
};

// Voice input for a text box.
//   onInterim(text)  the words being spoken right now (not final yet)
//   onFinal(text)    a finished piece of text to add
//   onError(message) something the user should be told
// Returns { supported, state: "idle" | "listening" | "transcribing",
//           toggle, stop, cancel }.
export const useSpeechInput = ({ onInterim, onFinal, onError }) => {
  const [state, setState] = useState("idle");
  const controllerRef = useRef(null);

  // The newest callbacks, without restarting the microphone when they change.
  const handlersRef = useRef({ onInterim, onFinal, onError });

  useEffect(() => {
    handlersRef.current = { onInterim, onFinal, onError };
  });

  const supported = useMemo(() => {
    const support = getSpeechSupport();
    return support.webSpeech || support.recorder;
  }, []);

  useEffect(() => {
    const controller = createSpeechInput({
      lang: getLanguage(),
      transcribe: transcribeAudio,
      onInterim: (text) => handlersRef.current.onInterim?.(text),
      onFinal: (text) => handlersRef.current.onFinal?.(text),
      onError: (message) => handlersRef.current.onError?.(message),
      onState: setState,
    });

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => controllerRef.current?.toggle(), []);
  const stop = useCallback(() => controllerRef.current?.stop(), []);
  const cancel = useCallback(() => controllerRef.current?.cancel(), []);

  return { supported, state, toggle, stop, cancel };
};