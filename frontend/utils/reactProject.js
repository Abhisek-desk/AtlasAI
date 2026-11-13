// Turns the files of an AI-generated React project into the shape that
// Sandpack (the in-browser bundler used for the preview) needs.

const CODE_FILE = /\.(jsx?|tsx?|mjs|cjs)$/i;
const REACT_IMPORT =
  /(?:from\s+|import\s+|require\(\s*)['"]react(?:-dom(?:\/client)?)?['"]/;

// Files that only matter to the project's own tooling, not to the preview.
const IGNORED_FILE =
  /(^|\/)(vite|postcss|tailwind|eslint|babel|webpack|next|jest|vitest)\.config\.[cm]?[jt]s$|(^|\/)\.eslintrc|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|README\.md|\.gitignore|\.env.*)$/i;

// Packages that are build tools, not something the running app imports.
const TOOLING_PACKAGES =
  /^(vite|react-scripts|typescript|eslint|postcss|autoprefixer|tailwindcss|webpack|babel|@babel|@vitejs|@types|@eslint|vitest|jest|prettier|sass-embedded)(\/|$)/;

const ENTRY_CANDIDATES = [
  "/src/main.jsx",
  "/src/main.tsx",
  "/src/main.js",
  "/src/main.ts",
  "/src/index.jsx",
  "/src/index.tsx",
  "/src/index.js",
  "/src/index.ts",
  "/main.jsx",
  "/main.tsx",
  "/index.jsx",
  "/index.tsx",
];

const APP_CANDIDATES = [
  "/src/App.jsx",
  "/src/App.tsx",
  "/src/App.js",
  "/src/App.ts",
  "/App.jsx",
  "/App.tsx",
  "/App.js",
];

// Our own entry file; it imports the project's real entry (or renders App).
const ENTRY_FILE = "/__atlas_entry.jsx";

const TAILWIND_CDN = "https://cdn.tailwindcss.com";

const toPath = (name) => "/" + String(name).replace(/^(\.\/|\/)+/, "");

const readJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// "@scope/pkg/deep/file" -> "@scope/pkg", "lodash/debounce" -> "lodash".
// Relative paths and aliases like "@/components" are not packages.
const packageName = (specifier) => {
  if (!specifier || /^(\.|\/|~|@\/|node:|https?:)/.test(specifier)) return null;

  const parts = specifier.split("/");

  if (specifier.startsWith("@")) {
    return parts.length >= 2 && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }

  return parts[0] || null;
};

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

const findImportedPackages = (codeFiles) => {
  const found = new Set();

  for (const file of codeFiles) {
    for (const match of file.content.matchAll(IMPORT_PATTERN)) {
      const name = packageName(match[1] || match[2] || match[3]);
      if (name) found.add(name);
    }
  }

  return found;
};

// Tailwind classes only work if Tailwind is loaded. Add it when the project
// clearly uses it (it also resets base styles, so it is not added blindly).
const TAILWIND_TOKEN =
  /\b(?:flex|grid|hidden|items-center|justify-(?:center|between)|(?:p|px|py|m|mx|my|mt|mb|ml|mr|pt|pb)-\d+|gap-\d+|rounded(?:-\w+)?|text-(?:xs|sm|base|lg|xl|\dxl)|font-(?:bold|semibold|medium)|(?:bg|text|border)-[a-z]+-\d{2,3}|w-full|h-screen|min-h-screen|shadow(?:-\w+)?)\b/g;

const CLASS_NAME_PATTERN =
  /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g;

const usesTailwind = (files, codeFiles, packageJson) => {
  const declared = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  if (declared.tailwindcss) return true;

  if (
    files.some(
      (file) =>
        /\.css$/i.test(file.name) &&
        /@tailwind\b|@import\s+["']tailwindcss/.test(file.content),
    )
  ) {
    return true;
  }

  const tokens = new Set();

  for (const file of codeFiles) {
    for (const match of file.content.matchAll(CLASS_NAME_PATTERN)) {
      const classes = match[1] || match[2] || match[3] || "";
      for (const token of classes.match(TAILWIND_TOKEN) || []) tokens.add(token);
    }
  }

  return tokens.size >= 4;
};

// Tailwind directives are meaningless to the browser (and "@import
// tailwindcss" would fail to load), so they are removed from the CSS.
const cleanCss = (css) =>
  css
    .replace(/^\s*@tailwind\s+[a-z]+\s*;?\s*$/gim, "")
    .replace(/^\s*@import\s+["']tailwindcss[^"']*["']\s*;?\s*$/gim, "");

// External <link>/<script> tags from the project's own index.html (fonts,
// icon sets, CDN scripts) are passed on to the preview.
const externalResourcesFrom = (indexHtml) => {
  const urls = [];

  for (const match of indexHtml.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const href = /href=["'](https?:\/\/[^"']+)["']/i.exec(tag)?.[1];
    if (href && /rel=["']?stylesheet/i.test(tag)) urls.push(href);
  }

  for (const match of indexHtml.matchAll(
    /<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi,
  )) {
    urls.push(match[1]);
  }

  return urls.slice(0, 5);
};

const hasDefaultExport = (content) => /export\s+default\b/.test(content);

export const isReactProject = (files) => {
  if (!Array.isArray(files) || files.length === 0) return false;

  if (files.some((file) => /\.(jsx|tsx)$/i.test(file.name))) return true;

  const pkg = readJson(
    files.find((file) => /(^|\/)package\.json$/i.test(file.name))?.content,
  );

  if (pkg?.dependencies?.react || pkg?.devDependencies?.react) return true;

  return files.some(
    (file) => CODE_FILE.test(file.name) && REACT_IMPORT.test(file.content),
  );
};

// Returns everything Sandpack needs, or { canRun: false, reason }.
export const buildSandpackProject = (files) => {
  const normalized = files.map((file) => ({
    name: toPath(file.name),
    content: String(file.content ?? ""),
  }));

  const byName = new Map(normalized.map((file) => [file.name, file]));
  const codeFiles = normalized.filter((file) => CODE_FILE.test(file.name));

  const packageJson = readJson(byName.get("/package.json")?.content);
  const indexHtml = byName.get("/index.html")?.content || "";

  // 1. Which file starts the app?
  const entry = ENTRY_CANDIDATES.find((path) => byName.has(path));
  const app = APP_CANDIDATES.find((path) => byName.has(path));
  const anyComponent = codeFiles.find(
    (file) => /\.(jsx|tsx)$/i.test(file.name) && hasDefaultExport(file.content),
  );

  let entryCode;

  if (entry) {
    entryCode = `import ".${entry}";\n`;
  } else {
    const target = app || anyComponent?.name;

    if (!target) {
      return {
        canRun: false,
        reason:
          "This project has no entry file (like src/main.jsx) or App component to preview.",
      };
    }

    entryCode =
      `import React from "react";\n` +
      `import { createRoot } from "react-dom/client";\n` +
      `import App from ".${target}";\n` +
      `createRoot(document.getElementById("root")).render(<App />);\n`;
  }

  // 2. Dependencies: the project's own, plus anything it imports.
  const dependencies = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.0",
  };

  for (const [name, version] of Object.entries(packageJson?.dependencies || {})) {
    if (!TOOLING_PACKAGES.test(name)) dependencies[name] = String(version);
  }

  for (const name of findImportedPackages(codeFiles)) {
    if (!dependencies[name] && !TOOLING_PACKAGES.test(name)) {
      dependencies[name] = "latest";
    }
  }

  // 3. The files themselves.
  const sandpackFiles = {};

  for (const file of normalized) {
    if (file.name === "/package.json" || file.name === "/index.html") continue;
    if (IGNORED_FILE.test(file.name)) continue;

    sandpackFiles[file.name] = {
      code: /\.css$/i.test(file.name) ? cleanCss(file.content) : file.content,
    };
  }

  sandpackFiles[ENTRY_FILE] = { code: entryCode };

  sandpackFiles["/public/index.html"] = {
    code:
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
      `<meta charset="UTF-8" />\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n` +
      `<title>Preview</title>\n</head>\n<body>\n<div id="root"></div>\n</body>\n</html>\n`,
  };

  sandpackFiles["/package.json"] = {
    code: JSON.stringify(
      { name: "preview", main: ENTRY_FILE, dependencies },
      null,
      2,
    ),
  };

  const externalResources = externalResourcesFrom(indexHtml);

  if (
    usesTailwind(normalized, codeFiles, packageJson) &&
    !externalResources.includes(TAILWIND_CDN)
  ) {
    externalResources.push(TAILWIND_CDN);
  }

  return {
    canRun: true,
    files: sandpackFiles,
    dependencies,
    main: ENTRY_FILE,
    externalResources,
  };
};