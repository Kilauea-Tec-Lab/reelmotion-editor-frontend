// Only public media hosts may be proxied (blocks SSRF to internal/metadata IPs).
const ALLOWED_HOSTS = (
  process.env.PROXY_VIDEO_ALLOWED_HOSTS ||
  'storage.googleapis.com,cdn.reelmotion.ai,backend.reelmotion.ai,videos.pexels.com,images.pexels.com,player.vimeo.com'
)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export const isAllowedUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};
