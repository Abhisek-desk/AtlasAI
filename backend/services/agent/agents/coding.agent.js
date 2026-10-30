import { checkAgentLimit } from "../config/agentlimit.js";
import { getModel } from "../config/llmModels.js";
import { getMemory } from "../config/memory.js";
import deductCredits from "../utils/deductCredits.js";

const MODEL_TIMEOUT_MS = 180000;
const HISTORY_LIMIT = 6;

const toText = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

// Some models wrap a whole Markdown answer in one ```markdown fence, which the
// chat would then show as a code block instead of a formatted reply.
const stripMarkdownFence = (text) => {
  const match = /^\s*```(?:markdown|md)[ \t]*\n([\s\S]*?)\n```\s*$/i.exec(text);

  return match ? match[1] : text;
};

// Large projects are written as raw text between tags instead of inside a JSON
// string: JSON needs every quote and newline in the code escaped, and one slip
// (or a cut-off reply) made the whole answer unparseable.
const FILE_RE =
  /<atlas-file\s+name=["']([^"']+)["']\s*>\n?([\s\S]*?)<\/atlas-file>/gi;
const OPEN_FILE_RE = /<atlas-file\s+name=["']([^"']+)["']\s*>\n?([\s\S]*)$/i;
const MESSAGE_RE = /<atlas-message>\s*([\s\S]*?)\s*<\/atlas-message>/i;

// Models sometimes put a ``` fence around the code inside a file tag.
const unfence = (code) => {
  const match = /^\s*```[\w+-]*[ \t]*\n([\s\S]*?)\n```\s*$/.exec(code);

  return match ? match[1] : code;
};

const cleanFile = (name, content) => ({
  name: name.trim(),
  content: `${unfence(content).replace(/\s+$/, "")}\n`,
});

const parseTaggedProject = (raw) => {
  const text = toText(raw);
  const files = [];
  let end = 0;
  let truncated = false;

  for (const match of text.matchAll(FILE_RE)) {
    files.push(cleanFile(match[1], match[2]));
    end = match.index + match[0].length;
  }

  // A reply that hit the length limit never closes its last file tag.
  const tail = OPEN_FILE_RE.exec(text.slice(end));

  if (tail && tail[2].trim()) {
    files.push(cleanFile(tail[1], tail[2]));
    truncated = true;
  }

  const valid = files.filter((file) => file.name && file.content.trim());

  if (valid.length === 0) return null;

  return {
    message: MESSAGE_RE.exec(text)?.[1]?.trim() || "",
    files: valid,
    truncated,
  };
};

// Fallback for models that still answer with the old JSON shape. Models often
// wrap that JSON in ``` fences or add a sentence around it.
const parseJsonProject = (raw) => {
  const text = toText(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));

    const files = (Array.isArray(parsed?.files) ? parsed.files : [])
      .filter(
        (file) =>
          file &&
          typeof file.name === "string" &&
          file.name.trim() &&
          typeof file.content === "string",
      )
      .map((file) => ({ name: file.name.trim(), content: file.content }));

    if (files.length === 0) return null;

    const message =
      typeof parsed?.message === "string" ? parsed.message.trim() : "";

    return { message, files, truncated: false };
  } catch {
    return null;
  }
};

const parseProject = (raw) => parseTaggedProject(raw) || parseJsonProject(raw);

// Only added when the user asks for pictures. source.unsplash.com no longer
// works, so the model must use direct images.unsplash.com photo URLs.
const IMAGE_RULES = `
IMAGES:
- Use real photos from Unsplash. Use direct URLs only, in this form: https://images.unsplash.com/photo-<ID>?auto=format&fit=crop&w=800&q=80
- Do NOT use source.unsplash.com (it no longer works) and do not invent photo IDs.
- Prefer these photo IDs (reuse them across items if you need more):
  photo-1513104890138-7c749659a591 (pizza)
  photo-1565299624946-b28f40a0ae38 (pizza on a board)
  photo-1568901346375-23c9450c58cd (burger)
  photo-1550547660-d9450f859349 (burger and fries)
  photo-1546069901-ba9599a7e63c (salad bowl)
  photo-1473093295043-cdd812d0e601 (pasta)
  photo-1579871494447-9811cf80d66c (sushi)
  photo-1565299585323-38d6b0865b47 (tacos)
  photo-1567620905732-2d1ec7ab7445 (pancakes)
  photo-1578985545062-69928b1d9587 (chocolate cake)
  photo-1504674900247-0877df9cc836 (food spread)
- Give every <img> a meaningful alt text and loading="lazy".
- Include a small script that replaces any <img> that fails to load with a neutral gray placeholder, so a missing photo never shows a broken-image icon.
`;

// Used when the model forgets the "message" field.
const buildFallbackMessage = (files) => {
  const names = files.map((file) => `\`${file.name}\``).join(", ");

  return `I've created ${
    files.length === 1 ? "1 file" : `${files.length} files`
  }: ${names}.\n\nOpen the artifact panel to preview, edit and download the code.`;
};

// Earlier turns include previously generated files, so edits can build on them.
const getHistoryText = async (conversationId) => {
  try {
    const history = await getMemory(conversationId);

    return history
      .slice(-HISTORY_LIMIT)
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
  } catch {
    return "";
  }
};

export const codingAgent = async (state) => {
  console.log("Coding agent started");

  try {
    await checkAgentLimit(state.userId, "coding");
    const intentLLM = await getModel("intent");
    const llm = await getModel("coding");

    // 1. Classify user intent
    const intentRes = await intentLLM.invoke(
      ` You are an intent classifier.
       Classify the user's request into exactly ONE of these categories:
        CODE_GENERATION
         CODE_REVIEW
          CODE_EXPLANATION DEBUGGING OPTIMIZATION CONVERSION DOCUMENTATION Return only the category name. 
          Do not include explanations, punctuation, or additional text. User Request: ${state.prompt} `,
    );
    const intent = toText(intentRes.content).trim().toUpperCase();
    console.log(intent);

    // Needed by every intent so follow-ups like "explain that code" have context.
    const historyText = await getHistoryText(state.conversationId);

    if (intent.includes("CODE_GENERATION")) {
      const wantsImages = /unsplash|image|photo|picture/i.test(state.prompt);

      const prompt = `
STACK:
- You are AtlasAI, an expert software engineer and programming assistant.
- Follow the programming language, framework, libraries, and tools requested by the user.
- If the user provides existing code, identify its technology stack from the code.
- If the user specifies a stack, follow it exactly.
- If the user does not specify a stack, infer a suitable stack from the available context.
- Preserve the existing project architecture and coding conventions.
- Do not introduce additional dependencies unless necessary.
- Do not use technologies that conflict with the user's requirements.

RULES:
- Understand the user's request before generating a solution.
- Follow the detected intent: ${intent}.
- Produce correct, practical, readable, and maintainable code.
- Preserve existing functionality when modifying existing code.
- Make only the changes necessary to fulfill the request.
- Do not invent APIs, functions, variables, files, or project requirements.
- Include necessary imports, exports, error handling, and dependencies.
- Use secure coding practices.
- Never expose API keys, passwords, tokens, or other secrets.
- Do not claim that code has been tested unless it has actually been tested.
- If essential information is missing, state your assumptions or ask a focused question.

OUTPUT FORMAT:
Return the response in exactly this format, with no text before or after it:
<atlas-message>
Short friendly reply for the chat, in Markdown.
</atlas-message>
<atlas-file name="index.html">
complete file content
</atlas-file>
<atlas-file name="style.css">
complete CSS content
</atlas-file>
<atlas-file name="script.js">
complete JavaScript content
</atlas-file>

MESSAGE FIELD:
- The text inside <atlas-message> is shown to the user in the chat, next to the generated files.
- Write it like a natural assistant reply: 2 to 6 short sentences or a few bullet points.
- Say what you built, how to run or use it, and mention any assumptions you made.
- Use Markdown (bold, bullets, \`inline code\`) but do NOT put code blocks or full file contents in the message.

STRICT OUTPUT REQUIREMENTS:
- Use one <atlas-file name="..."> tag per file and always close it with </atlas-file>.
- The name is the file path, for example index.html or src/App.jsx.
- Write the file content exactly as it should be saved. Do NOT use JSON, do NOT escape quotes or newlines, and do NOT wrap the content in Markdown code fences.
- Do not include any text outside the <atlas-message> and <atlas-file> tags.
- Never write the closing tag </atlas-file> inside a file's content.
- Keep the project focused so the whole response stays complete.

For React projects, separate components, pages, utilities, styles, and entry files according to the existing architecture.
For Node.js and Express projects, separate routes, controllers, services, models, configuration, and entry files when appropriate.
For other frameworks, use the conventional structure for that framework.

4. EXISTING PROJECTS
- Respect the user's existing directory structure and architecture.
- When the user asks to modify one file, provide only that file unless another change is essential.
- Do not rewrite unrelated files.
- Do not remove existing functionality unless explicitly requested or necessary to fix a problem.
- Clearly identify new files and modified files when multiple files are involved.
- Preserve existing naming conventions and import paths whenever possible.
- Do not assume that a file exists unless the user has provided it or its existence is established by the conversation.

RULES:
- Follow the user's explicit instructions about output format, code structure, and response length.
- If the user requests complete code, provide the complete code for the requested scope.
- If multiple files are necessary, provide each file separately.
- If only one file is requested, provide only that file.
- If the user requests a specific change only, do not add unrelated features.
- Do not provide multiple alternative implementations unless requested.
- Do not return the intent classification unless explicitly requested.
- Avoid unnecessary explanations when the user asks for code only.
- For debugging, explain the root cause when known and provide the minimal appropriate fix.
- Never present an unverified assumption as a confirmed diagnosis.
- Ensure that the response follows the requested technology stack and schema.
${wantsImages ? IMAGE_RULES : ""}${
        historyText
          ? `
PREVIOUS CONVERSATION (earlier generated files are included, build on them when the user asks for changes):
${historyText}
`
          : ""
      }
USER REQUEST:
${state.prompt}
`;

      console.log("Sending prompt to coding model...");

      const res = await llm.invoke(prompt, {
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });

      const project = parseProject(res.content);
      const finishReason = res.response_metadata?.finish_reason;

      if (!project) {
        // Malformed output should not crash the request with a 500.
        const text = toText(res.content);

        console.error(
          `Coding agent: could not parse the project (finish_reason: ${finishReason}, length: ${text.length})\nHEAD: ${text.slice(0, 300)}\nTAIL: ${text.slice(-300)}`,
        );

        return {
          ...state,
          aiResponse:
            finishReason === "length"
              ? "The code was too long for the model and got cut off. Try asking for a smaller project, or one part at a time."
              : "I couldn't turn the generated code into files. Please try again.",
          artifacts: [],
        };
      }

      let reply = project.message || buildFallbackMessage(project.files);

      if (project.truncated || finishReason === "length") {
        reply +=
          "\n\n> **Note:** the response hit the model's length limit, so the last file may be incomplete. Ask me to finish it or to split the project into smaller parts.";
      }

      await deductCredits(state.userId, "coding");

      return {
        ...state,
        // A real chat reply; the code itself lives in the artifact panel.
        aiResponse: reply,
        artifacts: [
          {
            id: Date.now(),
            type: "project",
            files: project.files,
            title: String(state.prompt).trim().slice(0, 60),
          },
        ],
      };
    }

    const res = await llm.invoke(
      `
The user's request is: ${intent}

Return markdown only.
Never forget project files.
Write the answer directly as Markdown. Do NOT wrap the whole response in a code fence (no \`\`\`markdown). Use code fences only around actual code.

Use headings like:
# Overview
## Explanation
## Problems
## Improvements
## Best Practices
## Optimized Code (if needed)
${
  historyText
    ? `
PREVIOUS CONVERSATION (the code the user refers to may be here):
${historyText}
`
    : ""
}
Use Request:
${state.prompt}
`,
      { signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) },
    );

    const data = stripMarkdownFence(toText(res.content));
    await deductCredits(state.userId, "coding");

    return {
      ...state,
      aiResponse: data,
      artifacts: [],
    };
  } catch (error) {
    console.error("Coding agent error:", error.message);
    throw error;
  }
};
