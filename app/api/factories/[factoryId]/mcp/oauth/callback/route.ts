import { finishMcpOAuth } from "@/app/lib/mcp/client";
import { getMcpConnectionById, getMcpOauthStateByState } from "@/app/lib/mcp/records";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ factoryId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { factoryId } = await context.params;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return new Response("Missing OAuth state or code", { status: 400 });
  }

  const oauthState = await getMcpOauthStateByState(state);

  if (!oauthState) {
    return new Response("OAuth state was not found", { status: 400 });
  }

  const connection = await getMcpConnectionById(oauthState.connectionId);

  if (!connection || connection.factory?.id !== factoryId) {
    return new Response("MCP connection was not found", { status: 404 });
  }

  try {
    const origin = process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const callbackUrl = `${origin}/api/factories/${factoryId}/mcp/oauth/callback`;

    await finishMcpOAuth({
      callbackUrl,
      code,
      factoryId,
      mcpServerId: connection.id,
    });
  } catch (error) {
    console.error(error);

    return new Response("MCP OAuth failed. Return to the factory and try again.", { status: 500 });
  }

  return new Response(
    `<html><body><h1>MCP connected</h1><p>You can close this window and return to Factory.</p></body></html>`,
    { headers: { "content-type": "text/html" } },
  );
}
