import { EXPORT_PRICES, type ExportResolution } from "../constants";
import { backendUrl } from "./require-auth";

export const INSUFFICIENT_TOKENS = "INSUFFICIENT_TOKENS";

export type ExportCharge = { userId: number; tokens: number };

/** Debit the export price with the user's own session; throws INSUFFICIENT_TOKENS on a 400. */
export async function chargeExport(authHeader: string, userId: number, resolution: ExportResolution): Promise<ExportCharge> {
  const tokens = EXPORT_PRICES[resolution];
  const res = await fetch(`${backendUrl()}/tokens/reduce-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
    body: JSON.stringify({ tokens }),
  });
  if (res.status === 400) throw new Error(INSUFFICIENT_TOKENS);
  if (!res.ok) throw new Error(`Token charge failed (${res.status})`);
  return { userId, tokens };
}

/** Give the tokens back when a paid render fails. Server-to-server: shared secret, not the user's token. */
export async function refundExport(charge: ExportCharge, renderId: string): Promise<void> {
  const secret = process.env.EDITOR_RENDER_SECRET;
  if (!secret) {
    console.error(`[Render ${renderId}] EDITOR_RENDER_SECRET missing — cannot refund ${charge.tokens} tokens to user ${charge.userId}`);
    return;
  }
  try {
    const res = await fetch(`${backendUrl()}/tokens/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Render-Secret": secret },
      body: JSON.stringify({ user_id: charge.userId, tokens: charge.tokens, render_id: renderId }),
    });
    if (!res.ok) console.error(`[Render ${renderId}] refund failed (${res.status})`);
  } catch (error) {
    console.error(`[Render ${renderId}] refund failed:`, error);
  }
}
