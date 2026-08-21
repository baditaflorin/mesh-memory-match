import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-memory-match",
  description: "An accessible browser-local matching game for small groups.",
  accentHex: "#8b5cf6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
