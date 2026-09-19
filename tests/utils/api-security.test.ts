/**
 * @jest-environment node
 */
import { isAllowedUrl } from "@/lib/proxy-allowlist";
import { verifyEditorToken } from "@/components/editor/version-7.0.0/ssr-helpers/require-auth";
import { chargeExport, refundExport, INSUFFICIENT_TOKENS } from "@/components/editor/version-7.0.0/ssr-helpers/export-billing";
import { EXPORT_PRICES } from "@/components/editor/version-7.0.0/constants";

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
    expect(await verifyEditorToken(null)).toBeNull();
    expect(await verifyEditorToken("Bearer ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the user behind a token the backend recognises and caches it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 200, user_id: 42 }) });
    expect(await verifyEditorToken("Bearer good")).toEqual({ userId: 42 });
    expect(await verifyEditorToken("Bearer good")).toEqual({ userId: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects tokens the backend refuses", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await verifyEditorToken("Bearer bad")).toBeNull();
  });
});

describe("export billing", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    process.env.EDITOR_RENDER_SECRET = "s3cret";
  });

  it("charges the flat price for the resolution with the user's own token", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const charge = await chargeExport("Bearer good", 42, "1080p");
    expect(charge).toEqual({ userId: 42, tokens: EXPORT_PRICES["1080p"] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/tokens\/reduce-tokens$/);
    expect(init.headers.Authorization).toBe("Bearer good");
    expect(JSON.parse(init.body)).toEqual({ tokens: EXPORT_PRICES["1080p"] });
  });

  it("surfaces INSUFFICIENT_TOKENS when the backend answers 400", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(chargeExport("Bearer poor", 42, "4k")).rejects.toThrow(INSUFFICIENT_TOKENS);
  });

  it("refunds server-to-server with the shared secret, never the user token", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await refundExport({ userId: 42, tokens: 25 }, "render-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/tokens\/refund$/);
    expect(init.headers["X-Render-Secret"]).toBe("s3cret");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ user_id: 42, tokens: 25, render_id: "render-1" });
  });
});
