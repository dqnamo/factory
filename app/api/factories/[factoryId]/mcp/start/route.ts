import { getErrorMessage, syncMcpConnection, validateMcpServerUrl } from "@/app/lib/mcp/client";
import { createMcpConnection, type McpAuthType, upsertMcpBearerToken } from "@/app/lib/mcp/records";
import { errorResponse, requireFactoryMember } from "@/app/lib/server-auth";

export const runtime = "nodejs";

type StartMcpRequest = {
  authType?: string;
  bearerToken?: string;
  name?: string;
  scopes?: string;
  url?: string;
};

type RouteContext = {
  params: Promise<{ factoryId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { factoryId } = await context.params;
  let body: StartMcpRequest;

  try {
    await requireFactoryMember(request, factoryId);
  } catch (error) {
    return errorResponse(error, "MCP setup could not be started.");
  }

  try {
    body = (await request.json()) as StartMcpRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const scopes = body.scopes?.trim();
  const url = body.url?.trim();
  const authType: McpAuthType = body.authType === "bearer_token" ? "bearer_token" : "oauth";
  const bearerToken = body.bearerToken?.trim();

  if (!name || !url) {
    return Response.json({ error: "name and url are required" }, { status: 400 });
  }

  if (authType === "bearer_token" && !bearerToken) {
    return Response.json(
      { error: "Bearer token is required for bearer-token auth." },
      { status: 400 },
    );
  }

  try {
    validateMcpServerUrl(url);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }

  try {
    const mcpServerId = await createMcpConnection({
      authType,
      factoryId,
      name,
      scopes,
      url: validateMcpServerUrl(url),
    });

    if (authType === "bearer_token" && bearerToken) {
      await upsertMcpBearerToken(mcpServerId, bearerToken);
    }

    const callbackUrl = getMcpCallbackUrl(factoryId, request);
    const result = await syncMcpConnection({
      callbackUrl,
      factoryId,
      mcpServerId,
    });

    return Response.json({
      authUrl: result.status === "authorization_required" ? result.authUrl : null,
      id: mcpServerId,
      status: result.status,
    });
  } catch (error) {
    console.error(error);

    return errorResponse(error, getErrorMessage(error));
  }
}

function getMcpCallbackUrl(factoryId: string, request: Request) {
  const origin = process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return `${origin}/api/factories/${factoryId}/mcp/oauth/callback`;
}
