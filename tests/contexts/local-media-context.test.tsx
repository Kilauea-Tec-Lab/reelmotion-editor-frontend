import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  LocalMediaProvider,
  useLocalMedia,
} from "@/components/editor/version-7.0.0/contexts/local-media-context";
import {
  uploadMediaFile,
  deleteMediaFile,
  getMediaDuration,
} from "@/components/editor/version-7.0.0/utils/media-upload";
import {
  registerLocalFile,
  releaseLocalFile,
  restoreLocalFiles,
  getLocalFile,
} from "@/components/editor/version-7.0.0/utils/local-file-store";
import { OverlayType } from "@/components/editor/version-7.0.0/types";

jest.mock("@/components/editor/version-7.0.0/utils/media-upload", () => ({
  uploadMediaFile: jest.fn(),
  deleteMediaFile: jest.fn(),
  getMediaDuration: jest.fn(),
}));

jest.mock("@/components/editor/version-7.0.0/utils/local-file-store", () => {
  const actual = jest.requireActual(
    "@/components/editor/version-7.0.0/utils/local-file-store"
  );
  return {
    ...actual,
    registerLocalFile: jest.fn(),
    releaseLocalFile: jest.fn(),
    restoreLocalFiles: jest.fn(),
    getLocalFile: jest.fn(),
  };
});

const mockFile = new File(["test"], "test.mp4", { type: "video/mp4" });
const localMedia = {
  id: "local-1",
  name: "test.mp4",
  type: "video" as const,
  path: "local://local-1",
  size: 4,
  lastModified: 0,
  thumbnail: "",
  duration: 10,
};
const backendUpload = {
  id: "b1",
  file_name: "old.mp4",
  file_url: "https://storage.googleapis.com/reelmotion-ai-videos/old.mp4",
  type: 2,
  created_at: "2024-01-01T00:00:00Z",
  thumbnail_url: "",
  duration: "3",
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LocalMediaProvider backendUploads={[backendUpload]}>{children}</LocalMediaProvider>
);

const renderProvider = async () => {
  const hook = renderHook(() => useLocalMedia(), { wrapper });
  // Children are gated until persisted local files are restored.
  await waitFor(() => expect(hook.result.current).not.toBeNull());
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  (restoreLocalFiles as jest.Mock).mockResolvedValue([]);
  (getMediaDuration as jest.Mock).mockResolvedValue(10);
  (registerLocalFile as jest.Mock).mockReturnValue(localMedia);
  (getLocalFile as jest.Mock).mockReturnValue(mockFile);
  (uploadMediaFile as jest.Mock).mockResolvedValue({
    id: "gcs-1",
    serverPath: "https://storage.googleapis.com/reelmotion-ai-videos/test.mp4",
    thumbnail: "thumb.jpg",
  });
});

describe("LocalMediaContext", () => {
  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useLocalMedia())).toThrow(
      "useLocalMedia must be used within a LocalMediaProvider"
    );
  });

  it("lists restored local files before backend uploads", async () => {
    (restoreLocalFiles as jest.Mock).mockResolvedValue([localMedia]);
    const { result } = await renderProvider();

    expect(result.current.localMediaFiles.map((f) => f.id)).toEqual(["local-1", "b1"]);
  });

  it("adds a picked file locally without uploading", async () => {
    const { result } = await renderProvider();

    await act(async () => {
      await result.current.addMediaFile(mockFile);
    });

    expect(uploadMediaFile).not.toHaveBeenCalled();
    expect(registerLocalFile).toHaveBeenCalledWith(
      mockFile,
      expect.objectContaining({ name: "test.mp4", type: "video", duration: 10 })
    );
    expect(result.current.localMediaFiles[0]).toEqual(localMedia);
  });

  it("rejects unsupported file types", async () => {
    const { result } = await renderProvider();
    await expect(
      result.current.addMediaFile(new File([""], "a.txt", { type: "text/plain" }))
    ).rejects.toThrow("Unsupported file type");
  });

  it("materializes: uploads each local src once, rewrites src/content, releases the file", async () => {
    (restoreLocalFiles as jest.Mock).mockResolvedValue([localMedia]);
    const { result } = await renderProvider();
    const overlays = [
      { id: 1, type: OverlayType.VIDEO, src: "local://local-1", content: "local://local-1" },
      { id: 2, type: OverlayType.VIDEO, src: "local://local-1", content: "local://local-1" },
      { id: 3, type: OverlayType.SOUND, src: "https://x/a.mp3", content: "a.mp3" },
    ] as any;
    const onProgress = jest.fn();

    let materialized: any[] = [];
    await act(async () => {
      materialized = await result.current.materializeOverlays(overlays, onProgress);
    });

    const gcs = "https://storage.googleapis.com/reelmotion-ai-videos/test.mp4";
    expect(uploadMediaFile).toHaveBeenCalledTimes(1);
    expect(materialized[0]).toMatchObject({ src: gcs, content: gcs });
    expect(materialized[1]).toMatchObject({ src: gcs, content: gcs });
    expect(materialized[2]).toBe(overlays[2]);
    expect(releaseLocalFile).toHaveBeenCalledWith("local://local-1");
    // Gallery entry now points at the upload
    expect(result.current.localMediaFiles[0]).toMatchObject({ id: "gcs-1", path: gcs });
  });

  it("materialize returns the same array when nothing is local", async () => {
    const { result } = await renderProvider();
    const overlays = [{ id: 1, type: OverlayType.TEXT }] as any;
    expect(await result.current.materializeOverlays(overlays)).toBe(overlays);
  });

  it("materialize fails when the local file is gone", async () => {
    (getLocalFile as jest.Mock).mockReturnValue(undefined);
    const { result } = await renderProvider();
    await expect(
      result.current.materializeOverlays([{ id: 1, type: OverlayType.VIDEO, src: "local://gone" }] as any)
    ).rejects.toThrow("Local file no longer available");
  });

  it("removes a local file without hitting the network", async () => {
    (restoreLocalFiles as jest.Mock).mockResolvedValue([localMedia]);
    const { result } = await renderProvider();

    await act(async () => {
      await result.current.removeMediaFile("local-1");
    });

    expect(releaseLocalFile).toHaveBeenCalledWith("local://local-1");
    expect(deleteMediaFile).not.toHaveBeenCalled();
    expect(result.current.localMediaFiles.map((f) => f.id)).toEqual(["b1"]);
  });
});
