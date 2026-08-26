import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-memory-match",
  breadcrumbs: false,
  displayName: "Memory Match",
  visualProfile: "play",
  shellLayout: "inset",
  description: "An accessible browser-local matching game for small groups.",
  accentHex: "#e5a43a",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
