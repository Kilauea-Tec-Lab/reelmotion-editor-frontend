import { NextResponse } from "next/server";

// ponytail: validated against the backend's editor endpoint (the only one that
// checks the token); results cached 5 min so polling doesn't hammer it.
const TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_TOKENS = 1000;
const validTokens = new Map<string, number>();

/** True when the `Authorization: Bearer <token>` header names a live editor session. */
export const verifyEditorToken = async (authHeader: string | null): Promise<boolean> => {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const now = Date.now();
  const cachedUntil = validTokens.get(token);
  if (cachedUntil && cachedUntil > now) return true;

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
  try {
    const res = await fetch(`${backendUrl}/editor/get-info-to-edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.code !== 200) return false;
  } catch (error) {
    console.error("Token verification failed:", error);
    return false;
  }

  if (validTokens.size >= MAX_CACHED_TOKENS) validTokens.clear();
  validTokens.set(token, now + TOKEN_TTL_MS);
  return true;
};

export const unauthorizedResponse = () =>
  NextResponse.json({ type: "error", message: "Unauthorized" }, { status: 401 });
