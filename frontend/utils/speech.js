// Voice input without any framework code, so it can be tested on its own.
//
// Two ways to turn speech into text:
//   1. "webspeech": the browser's built-in recognition. Free, and text appears
//      while you speak. (Chrome, Edge, Safari.)
//   2. "recorder": record the microphone, then send the audio to the server
//      (Groq Whisper) for transcription. Used when the browser has no built-in
//      recognition, or it fails (Brave, Firefox, no internet to Google...).
// If the built-in recognition fails in a way that means it will keep failing,
// the choice is remembered so the next click goes straight to the recorder.

const MODE_KEY = "atlas_speech_mode";
const DEFAULT_MAX_RECORD_MS = 120000; // stop recording after 2 minutes
const MIN_AUDIO_BYTES = 1500; // anything smaller is just silence/noise
const MAX_NO_SPEECH_RESTARTS = 2;

// Languages Whisper can be told about. For anything else it detects the
// language itself.
const WHISPER_LANGUAGES = new Set([
  "en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur", "ne",
  "es", "fr", "de", "pt", "it", "nl", "ru", "tr", "ar", "id", "ja", "ko", "zh",
]);

// Adds dictated text after existing text with a single space between them.
export const joinText = (base, addition) => {
  const first = String(base ?? "");
  const second = String(addition ?? "").trim();

  if (!second) return first;
  if (!first.trim()) return second;

  return /\s$/.test(first) ? first + second : `${first} ${second}`;
};

export const getSpeechSupport = (win = window) => ({
  webSpeech: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition),
  recorder: Boolean(
    win.navigator?.mediaDevices?.getUserMedia && win.MediaRecorder,
  ),
});

const pickMimeType = (MediaRecorderClass) =>
  [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4", // Safari
    "audio/ogg;codecs=opus",
  ].find((type) => MediaRecorderClass?.isTypeSupported?.(type)) || "";

const MIC_BLOCKED =
  "Microphone access is blocked. Allow the microphone in your browser's address bar, then try again.";

export const createSpeechInput = ({
  lang = "en-US",
  transcribe,
  onInterim,
  onFinal,
  onState,
  onError,
  win = window,
  maxRecordMs = DEFAULT_MAX_RECORD_MS,
}) => {
  const support = getSpeechSupport(win);
  const languageCode = String(lang).split("-")[0].toLowerCase();
  const whisperLanguage = WHISPER_LANGUAGES.has(languageCode)
    ? languageCode
    : undefined;

  let state = "idle"; // idle | listening | transcribing
  let mode = null; // webspeech | recorder
  let wanted = false; // the user wants to be listening right now
  let destroyed = false;
  let starting = false; // waiting for the microphone permission answer

  // webspeech
  let recognition = null;
  let nextFinalIndex = 0;
  let noSpeechRestarts = 0;

  // recorder
  let recorder = null;
  let stream = null;
  let chunks = [];
  let recordTimer = null;
  let discard = false;

  const storage = {
    get: () => {
      try {
        return win.localStorage.getItem(MODE_KEY);
      } catch {
        return null;
      }
    },
    set: (value) => {
      try {
        win.localStorage.setItem(MODE_KEY, value);
      } catch {
        // Storage can be blocked; the choice just isn't remembered.
      }
    },
  };

  const setState = (next) => {
    if (destroyed || state === next) return;
    state = next;
    onState?.(next);
  };

  const fail = (message) => {
    if (!destroyed) onError?.(message);
  };

  const releaseStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  /* ------------------------------ Recorder ------------------------------- */

  const startRecorder = async () => {
    try {
      stream = await win.navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      wanted = false;
      setState("idle");
      fail(
        error?.name === "NotFoundError"
          ? "No microphone was found."
          : MIC_BLOCKED,
      );
      return;
    }

    // The user cancelled while the permission question was open.
    if (destroyed || !wanted) {
      releaseStream();
      setState("idle");
      return;
    }

    const mimeType = pickMimeType(win.MediaRecorder);

    try {
      recorder = new win.MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
    } catch {
      releaseStream();
      wanted = false;
      setState("idle");
      fail("Voice recording isn't supported in this browser.");
      return;
    }

    chunks = [];
    discard = false;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    recorder.onerror = () => {
      fail("The microphone stopped working. Please try again.");
    };

    recorder.onstop = async () => {
      clearTimeout(recordTimer);
      releaseStream();

      const type = recorder?.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      chunks = [];
      recorder = null;
      wanted = false;

      if (discard || destroyed) {
        setState("idle");
        return;
      }

      if (blob.size < MIN_AUDIO_BYTES) {
        setState("idle");
        fail("I didn't catch that. Please try again.");
        return;
      }

      setState("transcribing");

      try {
        const text = String(await transcribe(blob, whisperLanguage)).trim();

        if (!destroyed) {
          if (text) {
            onFinal?.(text);
          } else {
            fail("I couldn't make out any words. Please try again.");
          }
        }
      } catch (error) {
        fail(
          error?.response?.data?.message ||
            "Voice transcription failed. Please try again.",
        );
      } finally {
        setState("idle");
      }
    };

    recorder.start();
    setState("listening");

    // Safety limit so a forgotten recording can't grow forever.
    recordTimer = setTimeout(() => stop(), maxRecordMs);
  };

  /* ----------------------------- Web Speech ------------------------------ */

  const switchToRecorder = () => {
    if (!support.recorder) {
      wanted = false;
      fail("Voice input isn't available in this browser right now.");
      return;
    }

    storage.set("recorder");
    mode = "recorder";
    wanted = true;
    startRecorder();
  };

  const handleSpeechError = (code) => {
    switch (code) {
      case "aborted":
        break; // we stopped it ourselves

      case "no-speech":
        noSpeechRestarts += 1;

        if (noSpeechRestarts > MAX_NO_SPEECH_RESTARTS) {
          wanted = false;
          fail("I didn't hear anything. Check your microphone and try again.");
        }
        break; // otherwise onend starts it again

      case "not-allowed":
        wanted = false;
        fail(MIC_BLOCKED);
        break;

      case "audio-capture":
        wanted = false;
        fail("No microphone was found.");
        break;

      // The browser's speech service can't be used here (blocked, offline,
      // not supported): record and transcribe on the server instead.
      case "network":
      case "service-not-allowed":
      case "language-not-supported":
        recognition?.abort?.();
        switchToRecorder();
        break;

      default:
        wanted = false;
        fail(`Voice input stopped (${code}). Please try again.`);
    }
  };

  const startWebSpeech = () => {
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    nextFinalIndex = 0;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event) => {
      noSpeechRestarts = 0;
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          // Some browsers repeat a finished result: use each only once.
          if (i >= nextFinalIndex) {
            nextFinalIndex = i + 1;
            if (text.trim()) onFinal?.(text.trim());
          }
        } else {
          interim += text;
        }
      }

      onInterim?.(interim.trim());
    };

    recognition.onerror = (event) => handleSpeechError(event.error);

    recognition.onend = () => {
      recognition = null;

      // Already switched to the recorder: nothing more to do here.
      if (mode !== "webspeech") return;

      onInterim?.("");

      if (!wanted || destroyed) {
        setState("idle");
        return;
      }

      // The browser ended the session by itself (e.g. after some silence).
      setTimeout(() => {
        if (wanted && !destroyed && mode === "webspeech") startWebSpeech();
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      wanted = false;
      recognition = null;
      setState("idle");
      fail("Voice input couldn't start. Please try again.");
    }
  };

  /* ------------------------------ Public API ----------------------------- */

  const start = async () => {
    // Ignore a second click while the first start is still in progress.
    if (destroyed || state !== "idle" || starting || recognition || recorder) {
      return;
    }

    if (support.webSpeech && storage.get() !== "recorder") {
      mode = "webspeech";
    } else if (support.recorder) {
      mode = "recorder";
    } else {
      fail("Voice input isn't supported in this browser.");
      return;
    }

    wanted = true;
    noSpeechRestarts = 0;

    if (mode === "webspeech") {
      startWebSpeech();
    } else {
      starting = true;

      try {
        await startRecorder();
      } finally {
        starting = false;
      }
    }
  };

  // Stop listening. Words already spoken are still turned into text.
  const stop = () => {
    if (destroyed) return;

    wanted = false;

    if (mode === "webspeech" && recognition) {
      recognition.stop();
    } else if (mode === "recorder" && recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  // Stop and throw away whatever was heard (used when the message is sent).
  const cancel = () => {
    if (destroyed) return;

    wanted = false;
    discard = true;

    if (mode === "webspeech" && recognition) {
      recognition.abort();
    } else if (mode === "recorder" && recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const toggle = () => {
    if (state === "idle") return start();
    if (state === "listening") return stop();
    return undefined; // transcribing: wait
  };

  const destroy = () => {
    if (destroyed) return;

    discard = true;
    wanted = false;
    clearTimeout(recordTimer);

    try {
      recognition?.abort?.();
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      // Already stopped.
    }

    releaseStream();
    destroyed = true;
  };

  return {
    start,
    stop,
    cancel,
    toggle,
    destroy,
    getState: () => state,
    support,
  };
};