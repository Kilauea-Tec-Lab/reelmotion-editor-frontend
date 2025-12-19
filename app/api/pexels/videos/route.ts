import { NextRequest, NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2) {
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      lastResponse = response;

      // Retry only on 5xx.
      if (response.status >= 500 && response.status <= 599 && attempt < attempts - 1) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }
  }

  return lastResponse!;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "popular").trim();
  const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || 30), 1), 80);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);

  const apiKey = process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Pexels API key not configured (set PEXELS_API_KEY)" },
      { status: 500 }
    );
  }

  const upstreamUrl =
    query.toLowerCase() === "popular"
      ? `https://api.pexels.com/videos/popular?per_page=${perPage}&page=${page}`
      : `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&size=medium`;

  try {
    const response = await fetchWithRetry(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
      cache: "no-store",
    });

    const text = await response.text();

    // Try to return JSON if possible; otherwise return raw text.
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: response.status });
    } catch {
      return new NextResponse(text, { status: response.status });
    }
  } catch (error) {
    console.error("Pexels videos proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch Pexels videos" }, { status: 500 });
  }
}
