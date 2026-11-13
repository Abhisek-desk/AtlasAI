import { useEffect, useMemo } from "react";
import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import { buildSandpackProject } from "../../utils/reactProject.js";

// Pushes edits made in the code editor into the running preview.
const FileSync = ({ files }) => {
  const { sandpack } = useSandpack();

  useEffect(() => {
    for (const [path, file] of Object.entries(files)) {
      if (sandpack.files[path]?.code !== file.code) {
        sandpack.updateFile(path, file.code);
      }
    }
    // Only when the project's files change, not on every Sandpack update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return null;
};

// Sandpack's wrappers must fill the panel, otherwise the preview collapses.
const FILL_STYLES = `
.atlas-preview, .atlas-preview .sp-wrapper, .atlas-preview .sp-preview,
.atlas-preview .sp-preview-container, .atlas-preview .sp-preview-iframe {
  height: 100%;
  width: 100%;
}
.atlas-preview .sp-preview { background: #fff; }
`;

const ReactPreview = ({ files, artifactId }) => {
  const project = useMemo(() => buildSandpackProject(files), [files]);

  if (!project.canRun) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-zinc-950 p-6 text-center text-sm text-zinc-400">
        {project.reason} Use the Code tab to view the files.
      </div>
    );
  }

  return (
    <div className="atlas-preview min-h-0 w-full flex-1 bg-white">
      <style>{FILL_STYLES}</style>

      <SandpackProvider
        // A new artifact starts a fresh preview.
        key={artifactId}
        template="react"
        files={project.files}
        customSetup={{
          entry: project.main,
          dependencies: project.dependencies,
        }}
        options={{
          externalResources: project.externalResources,
          recompileMode: "delayed",
          recompileDelay: 600,
        }}
      >
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton
        />
        <FileSync files={project.files} />
      </SandpackProvider>
    </div>
  );
};

export default ReactPreview;