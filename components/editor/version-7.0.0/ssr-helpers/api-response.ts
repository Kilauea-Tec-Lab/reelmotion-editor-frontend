import { NextResponse } from "next/server";
import { z, ZodType } from "zod";
import { unauthorizedResponse, verifyEditorToken } from "../ssr-helpers/require-auth";

export type ApiResponse<Res> =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "success";
      data: Res;
    };

export type ApiAuth = { userId: number; authHeader: string };

export const executeApi =
  <Res, Req extends ZodType>(
    schema: Req,
    handler: (req: Request, body: z.infer<Req>, auth: ApiAuth) => Promise<Res>
  ) =>
  async (req: Request) => {
    const authHeader = req.headers.get("authorization");
    const session = await verifyEditorToken(authHeader);
    if (!session) {
      return unauthorizedResponse();
    }
    try {
      const payload = await req.json();
      const parsed = schema.parse(payload);
      const data = await handler(req, parsed, { userId: session.userId, authHeader: authHeader as string });
      return NextResponse.json({
        type: "success",
        data: data,
      });
    } catch (err) {
      return NextResponse.json(
        { type: "error", message: (err as Error).message },
        {
          status: 500,
        }
      );
    }
  };
