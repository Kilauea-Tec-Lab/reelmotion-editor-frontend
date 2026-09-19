import { NextResponse } from "next/server";

// ponytail: validated against the backend's editor endpoint (the only one that
// checks the token); results cached 5 min so polling doesn't hammer it.
const TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_TOKENS = 1000;
const validTokens = new Map<string, { until: number; userId: number }>();

export const backendUrl = () => process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai/api";

/** The user behind `Authorization: Bearer <token>`, or null when it is not a live editor session. */
export const verifyEditorToken = async (authHeader: string | null): Promise<{ userId: number } | null> => {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const now = Date.now();
  const cached = validTokens.get(token);
  if (cached && cached.until > now) return { userId: cached.userId };

  let userId: number;
  try {
    const res = await fetch(`${backendUrl()}/editor/get-info-to-edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== 200 || !data.user_id) return null;
    userId = Number(data.user_id);
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }

  if (validTokens.size >= MAX_CACHED_TOKENS) validTokens.clear();
  validTokens.set(token, { until: now + TOKEN_TTL_MS, userId });
  return { userId };
};

export const unauthorizedResponse = () =>
  NextResponse.json({ type: "error", message: "Unauthorized" }, { status: 401 });
