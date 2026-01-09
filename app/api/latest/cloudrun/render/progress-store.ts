/**
 * Type for render progress state
 */
export type RenderProgressState = {
  status: "pending" | "rendering" | "done" | "error";
  progress: number;
  url?: string;
  size?: number;
  error?: string;
  bucketName?: string;
};

/**
 * Global store for render progress that persists across hot-reloads in development
 * Uses globalThis pattern to maintain state between API route invocations
 */
const globalForProgress = globalThis as unknown as {
  renderProgressStore: Map<string, RenderProgressState>;
};

// Initialize the Map only once
if (!globalForProgress.renderProgressStore) {
  globalForProgress.renderProgressStore = new Map<string, RenderProgressState>();
}

export const renderProgressStore = globalForProgress.renderProgressStore;
