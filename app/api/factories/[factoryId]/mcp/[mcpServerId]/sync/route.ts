import {
  syncMcpConnection,
  getErrorMessage,
} from "@/app/lib/mcp/client";
import { upsertMcpBearerToken } from "@/app/lib/mcp/records";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ factoryId: string; mcpServerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { factoryId, mcpServerId } = await context.params;

  let bearerToken: string | undefined;

  try {
    const body = (await request.json().catch(() => null)) as {
      bearerToken?: string;
    } | null;
    bearerToken = body?.bearerToken?.trim() || undefined;
  } catch {
    // no body is fine
  }

  try {
    if (bearerToken) {
      await upsertMcpBearerToken(mcpServerId, bearerToken);
    }

    const origin =
      process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const callbackUrl = `${origin}/api/factories/${factoryId}/mcp/oauth/callback`;

    const result = await syncMcpConnection({
      callbackUrl,
      factoryId,
      mcpServerId,
    });

    return Response.json({
      authUrl:
        result.status === "authorization_required" ? result.authUrl : null,
      status: result.status,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
