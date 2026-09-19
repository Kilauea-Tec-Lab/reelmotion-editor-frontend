import {
  collectLocalSrcs,
  isLocalSrc,
  registerLocalFile,
  releaseLocalFile,
  resolveLocalSrc,
  restoreLocalFiles,
} from "@/components/editor/version-7.0.0/utils/local-file-store";
import {
  prepareUrlForRender,
  resolveMediaUrl,
  resolveVideoUrl,
  toAbsoluteUrl,
} from "@/components/editor/version-7.0.0/utils/url-helper";
import {
  listLocalFileRecords,
  putLocalFileRecord,
  deleteLocalFileRecord,
} from "@/components/editor/version-7.0.0/utils/indexdb-helper";
import { OverlayType } from "@/components/editor/version-7.0.0/types";

jest.mock("@/components/editor/version-7.0.0/utils/indexdb-helper", () => ({
  putLocalFileRecord: jest.fn().mockResolvedValue(undefined),
  deleteLocalFileRecord: jest.fn().mockResolvedValue(undefined),
  listLocalFileRecords: jest.fn().mockResolvedValue([]),
}));

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
const meta = { name: "clip.mp4", type: "video" as const, size: 1, lastModified: 0 };

beforeAll(() => {
  let n = 0;
  (URL as any).createObjectURL = jest.fn(() => `blob:mock/${++n}`);
  (URL as any).revokeObjectURL = jest.fn();
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => `uuid-${Math.random()}` },
    });
  }
});

describe("local file store", () => {
  it("registers a file as local:// and resolves it to an object URL everywhere", () => {
    const media = registerLocalFile(file, meta);

    expect(isLocalSrc(media.path)).toBe(true);
    expect(putLocalFileRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: media.id, file, meta: media })
    );
    const blob = resolveLocalSrc(media.path);
    expect(blob).toMatch(/^blob:/);
    expect(resolveMediaUrl(media.path)).toBe(blob);
    expect(resolveVideoUrl(media.path)).toBe(blob); // never proxied
    expect(toAbsoluteUrl(media.path)).toBe(media.path);
    expect(prepareUrlForRender(media.path)).toBe(media.path); // Player keeps it; render refuses it
  });

  it("releases: revokes the URL, forgets the file, deletes the record", () => {
    const media = registerLocalFile(file, meta);
    releaseLocalFile(media.path);

    expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(resolveLocalSrc(media.path)).toBe("");
    expect(deleteLocalFileRecord).toHaveBeenCalledWith(media.id);
  });

  it("restores persisted records once and returns their metadata", async () => {
    (listLocalFileRecords as jest.Mock).mockResolvedValue([
      { id: "r1", file, meta: { ...meta, id: "r1", path: "local://r1" } },
    ]);

    const restored = await restoreLocalFiles();
    await restoreLocalFiles();

    expect(restored).toEqual([expect.objectContaining({ id: "r1" })]);
    expect(resolveLocalSrc("local://r1")).toMatch(/^blob:/);
    expect(listLocalFileRecords).toHaveBeenCalledTimes(1);
  });

  it("collects unique local srcs from overlays", () => {
    const overlays = [
      { id: 1, type: OverlayType.VIDEO, src: "local://a" },
      { id: 2, type: OverlayType.VIDEO, src: "local://a" },
      { id: 3, type: OverlayType.IMAGE, src: "https://x/y.png" },
      { id: 4, type: OverlayType.TEXT },
    ] as any;
    expect(collectLocalSrcs(overlays)).toEqual(["local://a"]);
  });
});
