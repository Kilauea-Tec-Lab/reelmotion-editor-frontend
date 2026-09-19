/**
 * Local file store
 *
 * Files the user picks are previewed straight from the browser (object URL)
 * and only uploaded when the project is exported or saved to the backend.
 * Overlays reference them as `local://<id>`; url-helper resolves that to the
 * object URL at render time. Files are mirrored in IndexedDB so a reload in
 * the same browser restores them.
 */
import type { LocalMediaFile, Overlay } from "../types";
import {
  deleteLocalFileRecord,
  listLocalFileRecords,
  putLocalFileRecord,
} from "./indexdb-helper";

const LOCAL_SCHEME = "local://";

const files = new Map<string, { file: File; url: string }>();

export const isLocalSrc = (src: unknown): boolean =>
  typeof src === "string" && src.startsWith(LOCAL_SCHEME);

const idOf = (src: string) => src.slice(LOCAL_SCHEME.length);

const register = (id: string, file: File) => {
  if (!files.has(id)) files.set(id, { file, url: URL.createObjectURL(file) });
};

/** Register a picked file. Persisted best-effort: without it a reload loses the file. */
export const registerLocalFile = (
  file: File,
  meta: Omit<LocalMediaFile, "id" | "path">
): LocalMediaFile => {
  const id = crypto.randomUUID();
  const media: LocalMediaFile = { ...meta, id, path: LOCAL_SCHEME + id };
  register(id, file);
  putLocalFileRecord({ id, file, meta: media }).catch((err) =>
    console.warn("Local file not persisted; a reload will drop it:", err)
  );
  return media;
};

export const getLocalFile = (src: string): File | undefined =>
  files.get(idOf(src))?.file;

/** `local://` → object URL, or "" when the file is not in memory. */
export const resolveLocalSrc = (src: string): string =>
  files.get(idOf(src))?.url ?? "";

export const releaseLocalFile = (src: string) => {
  const id = idOf(src);
  const entry = files.get(id);
  if (entry) URL.revokeObjectURL(entry.url);
  files.delete(id);
  deleteLocalFileRecord(id).catch(() => undefined);
};

let restoring: Promise<LocalMediaFile[]> | null = null;

/** Load persisted files into memory (once per page). Never rejects. */
export const restoreLocalFiles = (): Promise<LocalMediaFile[]> => {
  restoring ??= listLocalFileRecords()
    .then((records) => {
      records.forEach((r) => register(r.id, r.file));
      return records.map((r) => r.meta);
    })
    .catch((err) => {
      console.warn("Could not restore local files:", err);
      return [];
    });
  return restoring;
};

/** Unique `local://` srcs referenced by overlays. */
export const collectLocalSrcs = (overlays: Overlay[]): string[] =>
  Array.from(
    new Set(
      overlays
        .map((o) => (o as { src?: unknown }).src)
        .filter((src): src is string => isLocalSrc(src))
    )
  );
