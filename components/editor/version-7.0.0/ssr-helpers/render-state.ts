import fs from "fs";
import path from "path";

const RENDER_STATE_DIR = path.join(process.cwd(), "tmp", "render-state");

// Ensure the directory exists
if (!fs.existsSync(RENDER_STATE_DIR)) {
  fs.mkdirSync(RENDER_STATE_DIR, { recursive: true });
}

export const saveRenderState = (renderId: string, state: any) => {
  const filePath = path.join(RENDER_STATE_DIR, `${renderId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state));
};

export const getRenderState = (renderId: string) => {
  const filePath = path.join(RENDER_STATE_DIR, `${renderId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const PROGRESS_WRITE_INTERVAL_MS = 1000;
const lastProgressWrite = new Map<string, number>();

// Called once per rendered frame: write at most once a second and never
// after the render has already finished or failed.
export const updateRenderProgress = (renderId: string, progress: number) => {
  const now = Date.now();
  if (now - (lastProgressWrite.get(renderId) ?? 0) < PROGRESS_WRITE_INTERVAL_MS) return;
  const state = getRenderState(renderId) || {};
  if (state.status === "done" || state.status === "error") return;
  state.progress = progress;
  state.status = "rendering";
  saveRenderState(renderId, state);
  lastProgressWrite.set(renderId, now);
};

const STATE_TTL_MS = 24 * 60 * 60 * 1000;

/** Drop state files older than a day (called when a render starts). */
export const cleanupOldRenderStates = () => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const name of fs.readdirSync(RENDER_STATE_DIR)) {
    const filePath = path.join(RENDER_STATE_DIR, name);
    try {
      if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Failed to clean render state:", error);
    }
  }
};

export const completeRender = (renderId: string, url: string, size: number) => {
  lastProgressWrite.delete(renderId);
  const state = getRenderState(renderId) || {};
  state.status = "done";
  state.url = url;
  state.size = size;
  saveRenderState(renderId, state);
};

export const failRender = (renderId: string, error: string) => {
  lastProgressWrite.delete(renderId);
  const state = getRenderState(renderId) || {};
  state.status = "error";
  state.error = error;
  saveRenderState(renderId, state);
};
