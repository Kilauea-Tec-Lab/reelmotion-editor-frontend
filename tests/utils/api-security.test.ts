/**
 * @jest-environment node
 */
import { isAllowedUrl } from "@/lib/proxy-allowlist";
import { verifyEditorToken } from "@/components/editor/version-7.0.0/ssr-helpers/require-auth";

describe("proxy-video allowlist", () => {
  it("only proxies https media hosts", () => {
    expect(isAllowedUrl("https://storage.googleapis.com/reelmotion-ai-videos/a.mp4")).toBe(true);
    expect(isAllowedUrl("https://videos.pexels.com/x.mp4")).toBe(true);
    expect(isAllowedUrl("http://storage.googleapis.com/a.mp4")).toBe(false);
    expect(isAllowedUrl("http://169.254.169.254/computeMetadata/v1/")).toBe(false);
    expect(isAllowedUrl("https://evil.com/storage.googleapis.com/a.mp4")).toBe(false);
    expect(isAllowedUrl("not a url")).toBe(false);
  });
});

describe("verifyEditorToken", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
  });

  it("rejects missing tokens without calling the backend", async () => {
    expect(await verifyEditorToken(null)).toBe(false);
    expect(await verifyEditorToken("Bearer ")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a token the backend recognises and caches it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 200 }) });
    expect(await verifyEditorToken("Bearer good")).toBe(true);
    expect(await verifyEditorToken("Bearer good")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects tokens the backend refuses", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await verifyEditorToken("Bearer bad")).toBe(false);
  });
});
