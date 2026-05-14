import "server-only";

import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PersistentFactoryMcpOAuthProvider } from "@/app/lib/mcp/oauth-provider";
import {
  getMcpBearerToken,
  getMcpConnection,
  getMcpOauthState,
  listMcpCapabilitiesForConnection,
  type McpConnectionRecord,
  saveMcpCapabilities,
  updateMcpConnection,
} from "@/app/lib/mcp/records";

type SyncResult =
  | {
      authUrl?: string;
      connection: McpConnectionRecord;
      status: "authorization_required";
    }
  | {
      connection: McpConnectionRecord;
      status: "ready";
    };

export function validateMcpServerUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("MCP URL must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("MCP URL must use http or https.");
  }

  return url.toString();
}

export async function syncMcpConnection({
  callbackUrl,
  factoryId,
  mcpServerId,
}: {
  callbackUrl: string;
  factoryId: string;
  mcpServerId: string;
}): Promise<SyncResult> {
  const connection = await requireMcpConnection({ factoryId, mcpServerId });

  validateMcpServerUrl(connection.url);
  await updateMcpConnection(connection.id, {
    lastError: null,
    status: "pending",
    syncStatus: "pending",
  });

  let clientContext: Awaited<ReturnType<typeof createMcpClient>> | undefined;

  try {
    clientContext = await createMcpClient(connection, callbackUrl);
    await clientContext.client.connect(clientContext.transport);
  } catch (error) {
    await clientContext?.client.close().catch(() => null);

    if (error instanceof UnauthorizedError) {
      const capabilities = await listMcpCapabilitiesForConnection(
        connection.id,
      );
      const authType = getMcpAuthType(connection);
      const authUrl =
        authType === "oauth"
          ? await getStoredAuthorizationUrl(connection.id)
          : undefined;
      const lastError =
        authType === "bearer_token"
          ? "Bearer token was rejected or expired."
          : null;

      await updateMcpConnection(connection.id, {
        authStatus: "authorization_required",
        lastError,
        loginUrl: authUrl,
        status:
          capabilities.length > 0 && authType === "oauth"
            ? "authenticated"
            : "failed",
        syncStatus: authType === "oauth" ? "pending" : "failed",
      });

      return {
        authUrl,
        connection: {
          ...connection,
          authStatus: "authorization_required",
          lastError,
          loginUrl: authUrl,
          status:
            capabilities.length > 0 && authType === "oauth"
              ? "authenticated"
              : "failed",
          syncStatus: authType === "oauth" ? "pending" : "failed",
        },
        status: "authorization_required",
      };
    }

    const lastError = getErrorMessage(error);
    await updateMcpConnection(connection.id, {
      authStatus: "failed",
      lastError,
      status: "failed",
      syncStatus: "failed",
    });
    throw error;
  }

  try {
    const capabilities = await listRemoteCapabilities(clientContext.client);
    const syncedAt = new Date().toISOString();

    await saveMcpCapabilities(connection, capabilities);
    await updateMcpConnection(connection.id, {
      authStatus: "authorized",
      authenticatedAt: syncedAt,
      lastError: null,
      lastSyncAt: syncedAt,
      loginUrl: null,
      status: "authenticated",
      syncStatus: "ready",
    });

    return {
      connection: {
        ...connection,
        authStatus: "authorized",
        authenticatedAt: syncedAt,
        lastError: null,
        lastSyncAt: syncedAt,
        loginUrl: undefined,
        status: "authenticated",
        syncStatus: "ready",
      },
      status: "ready",
    };
  } finally {
    await clientContext.client.close();
  }
}

export async function finishMcpOAuth({
  callbackUrl,
  code,
  factoryId,
  mcpServerId,
}: {
  callbackUrl: string;
  code: string;
  factoryId: string;
  mcpServerId: string;
}) {
  const connection = await requireMcpConnection({ factoryId, mcpServerId });
  const clientContext = await createMcpClient(connection, callbackUrl);

  await clientContext.transport.finishAuth(code);
  await clientContext.client.close().catch(() => null);

  return syncMcpConnection({ callbackUrl, factoryId, mcpServerId });
}

async function requireMcpConnection({
  factoryId,
  mcpServerId,
}: {
  factoryId: string;
  mcpServerId: string;
}) {
  const connection = await getMcpConnection({ factoryId, mcpServerId });

  if (!connection) {
    throw new Error("MCP connection not found.");
  }

  return connection;
}

async function createMcpClient(
  connection: McpConnectionRecord,
  callbackUrl: string,
) {
  const client = new Client(
    { name: "factory", version: "0.1.0" },
    { capabilities: {} },
  );

  if (getMcpAuthType(connection) === "bearer_token") {
    const bearerToken = await getMcpBearerToken(connection.id);

    if (!bearerToken) {
      throw new Error("Bearer token is missing for this MCP connection.");
    }

    const transport = new StreamableHTTPClientTransport(
      new URL(connection.url),
      {
        requestInit: {
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      },
    );

    return { client, transport };
  }

  const provider = new PersistentFactoryMcpOAuthProvider(
    connection,
    callbackUrl,
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(connection.url),
    { authProvider: provider },
  );

  return { client, transport };
}

function getMcpAuthType(connection: McpConnectionRecord) {
  return connection.authType === "bearer_token" ? "bearer_token" : "oauth";
}

async function listRemoteCapabilities(client: Client) {
  const tools = await client.listTools().catch(() => ({ tools: [] }));
  const prompts = await client.listPrompts().catch(() => ({ prompts: [] }));
  const resources = await client
    .listResources()
    .catch(() => ({ resources: [] }));

  return [
    ...tools.tools.map((tool) => ({
      capabilityType: "tool" as const,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      upstreamName: tool.name,
    })),
    ...prompts.prompts.map((prompt) => ({
      capabilityType: "prompt" as const,
      description: prompt.description,
      upstreamName: prompt.name,
    })),
    ...resources.resources.map((resource) => ({
      capabilityType: "resource" as const,
      description: resource.description,
      upstreamName: resource.name ?? resource.uri,
    })),
  ];
}

async function getStoredAuthorizationUrl(connectionId: string) {
  const state = await getMcpOauthState(connectionId);
  return state?.authorizationUrl ?? undefined;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
