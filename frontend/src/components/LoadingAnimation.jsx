import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bot } from "lucide-react";

// Extra reassurance for slow requests (PDFs, slides, code projects).
const STATUS_STEPS = [
  { after: 25, text: "Big requests like PDFs, slides and code projects can take a minute..." },
  { after: 7, text: "Still working on it..." },
];

const useStatusText = (enabled) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);

    return () => clearInterval(timer);
  }, [enabled]);

  return STATUS_STEPS.find((step) => seconds >= step.after)?.text || "";
};

// Three bouncing dots, used for "the assistant is typing".
const Dots = ({ reduced }) => (
  <span className="flex items-center gap-1.5" aria-hidden="true">
    {[0, 1, 2].map((index) => (
      <motion.span
        key={index}
        className="h-2 w-2 rounded-full bg-gray-400"
        animate={
          reduced
            ? { opacity: [0.35, 1, 0.35] }
            : { y: [0, -6, 0], opacity: [0.4, 1, 0.4] }
        }
        transition={{
          duration: 0.9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.15,
        }}
      />
    ))}
  </span>
);

/**
 * variant="typing"  - dots next to the assistant avatar (chat is sending)
 * variant="page"    - centred logo + rings, for loading a conversation / the app
 * variant="spinner" - small ring for buttons and inline use
 */
const LoadingAnimation = ({
  variant = "typing",
  label = "",
  showStatus = true,
  className = "",
}) => {
  const reduced = Boolean(useReducedMotion());
  const statusText = useStatusText(variant === "typing" && showStatus);

  if (variant === "spinner") {
    return (
      <span
        role="status"
        aria-label={label || "Loading"}
        className={`inline-flex ${className}`}
      >
        <motion.span
          className="block h-4 w-4 rounded-full border-2 border-white/20 border-t-white"
          animate={reduced ? { opacity: [0.4, 1, 0.4] } : { rotate: 360 }}
          transition={
            reduced
              ? { duration: 1.2, repeat: Infinity }
              : { duration: 0.8, repeat: Infinity, ease: "linear" }
          }
        />
      </span>
    );
  }

  if (variant === "page") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center gap-5 px-6 text-center ${className}`}
      >
        <div className="relative flex h-16 w-16 items-center justify-center">
          <motion.span
            className="absolute inset-0 rounded-full bg-violet-500/25 blur-xl"
            animate={
              reduced
                ? { opacity: [0.5, 0.8, 0.5] }
                : { scale: [1, 1.35, 1], opacity: [0.5, 0.9, 0.5] }
            }
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.span
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-violet-400"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />

          <motion.span
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#171a22] text-violet-300"
            initial={reduced ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Bot size={20} />
          </motion.span>
        </div>

        {label && (
          <motion.p
            className="text-sm text-gray-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {label}
          </motion.p>
        )}

        <span className="sr-only">{label || "Loading"}</span>
      </div>
    );
  }

  // typing
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "AtlasAI is responding"}
      className={`flex min-w-0 flex-col items-start gap-2 pt-2 ${className}`}
    >
      <Dots reduced={reduced} />

      {label && <span className="text-xs text-gray-500">{label}</span>}

      <AnimatePresence mode="wait" initial={false}>
        {statusText && (
          <motion.span
            key={statusText}
            className="text-xs text-gray-500"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {statusText}
          </motion.span>
        )}
      </AnimatePresence>

      <span className="sr-only">AtlasAI is responding</span>
    </div>
  );
};

export default LoadingAnimation;