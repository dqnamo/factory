import "server-only";

import { id } from "@instantdb/admin";
import { db } from "@/app/lib/admin-db";
import { decryptMcpValue, encryptMcpValue } from "@/app/lib/mcp/crypto";

export type McpAuthType = "bearer_token" | "oauth";

export type McpConnectionRecord = {
  authType?: McpAuthType;
  authStatus?: string;
  authenticatedAt?: string;
  enabled?: boolean;
  id: string;
  lastError?: null | string;
  lastSyncAt?: string;
  loginUrl?: null | string;
  name: string;
  scopes?: string;
  status: string;
  syncStatus?: string;
  url: string;
};

export type McpCapabilityRecord = {
  capabilityType: string;
  createdAt: string;
  description?: string;
  enabled: boolean;
  id: string;
  inputSchema?: unknown;
  mcpServerId: string;
  namespacedName: string;
  outputSchema?: unknown;
  updatedAt: string;
  upstreamName: string;
};

type McpOauthStateRecord = {
  authorizationUrl?: null | string;
  connectionId: string;
  createdAt: string;
  discoveryState?: unknown;
  encryptedClientInformation?: null | string;
  encryptedCodeVerifier?: null | string;
  encryptedTokens?: null | string;
  id: string;
  state: string;
  updatedAt: string;
};

type McpCredentialRecord = {
  connectionId: string;
  createdAt: string;
  credentialType: string;
  encryptedBearerToken?: null | string;
  id: string;
  updatedAt: string;
};

type SyncedCapability = {
  capabilityType: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  upstreamName: string;
};

type McpConnectionWithFactory = McpConnectionRecord & {
  factory?: { id?: string };
};

type RawMcpConnectionWithFactory = McpConnectionRecord & {
  factory?: { id?: string } | { id?: string }[];
};

export async function getMcpConnection({
  factoryId,
  mcpServerId,
}: {
  factoryId: string;
  mcpServerId: string;
}): Promise<McpConnectionWithFactory | undefined> {
  const result = await db.query({
    factoryMcpServers: {
      $: { where: { id: mcpServerId } },
      factory: {},
    },
  });
  const connection = result.factoryMcpServers[0] as unknown as
    | RawMcpConnectionWithFactory
    | undefined;
  const linkedFactory = Array.isArray(connection?.factory)
    ? connection?.factory[0]
    : connection?.factory;

  if (!connection || linkedFactory?.id !== factoryId) {
    return undefined;
  }

  return { ...connection, factory: linkedFactory };
}

export async function getMcpConnectionById(
  mcpServerId: string,
): Promise<McpConnectionWithFactory | undefined> {
  const result = await db.query({
    factoryMcpServers: {
      $: { where: { id: mcpServerId } },
      factory: {},
    },
  });

  const connection = result.factoryMcpServers[0] as unknown as
    | RawMcpConnectionWithFactory
    | undefined;
  const linkedFactory = Array.isArray(connection?.factory)
    ? connection?.factory[0]
    : connection?.factory;

  return connection ? { ...connection, factory: linkedFactory } : undefined;
}

export async function createMcpConnection({
  authType = "oauth",
  factoryId,
  name,
  scopes,
  url,
}: {
  authType?: McpAuthType;
  factoryId: string;
  name: string;
  scopes?: string;
  url: string;
}) {
  const mcpServerId = id();

  await db.transact([
    db.tx.factoryMcpServers[mcpServerId].update({
      authType,
      authStatus: "none",
      enabled: true,
      lastError: null,
      name,
      scopes,
      status: "pending",
      syncStatus: "pending",
      url,
    }),
    db.tx.factories[factoryId].link({ mcpServers: mcpServerId }),
  ]);

  return mcpServerId;
}

export async function updateMcpConnection(
  mcpServerId: string,
  values: Partial<McpConnectionRecord>,
) {
  await db.transact(db.tx.factoryMcpServers[mcpServerId].update(values));
}

export async function listMcpCapabilitiesForConnection(mcpServerId: string) {
  const result = await db.query({
    factoryMcpCapabilities: {
      $: { where: { mcpServerId } },
    },
  });

  return result.factoryMcpCapabilities as McpCapabilityRecord[];
}

export async function saveMcpCapabilities(
  connection: McpConnectionRecord,
  capabilities: SyncedCapability[],
) {
  const existing = await listMcpCapabilitiesForConnection(connection.id);
  const now = new Date().toISOString();
  const nextKeys = new Set(capabilities.map((c) => `${c.capabilityType}:${c.upstreamName}`));
  const nextCapabilities = capabilities.map((capability) => {
    const current = existing.find(
      (item) =>
        item.capabilityType === capability.capabilityType &&
        item.upstreamName === capability.upstreamName,
    );

    return { capability, capabilityId: current?.id ?? id(), current };
  });

  const safeName = (connId: string, name: string) => {
    const slug = name
      .toLowerCase()
      .replaceAll(/[^a-z0-9_]+/g, "_")
      .replaceAll(/^_+|_+$/g, "");
    return `mcp_${connId.slice(0, 8)}_${slug || "tool"}`;
  };

  const transactions = [
    ...nextCapabilities.map(({ capability, capabilityId, current }) =>
      db.tx.factoryMcpCapabilities[capabilityId].update({
        capabilityType: capability.capabilityType,
        createdAt: current?.createdAt ?? now,
        description: capability.description,
        enabled: current?.enabled ?? true,
        inputSchema: capability.inputSchema as never,
        mcpServerId: connection.id,
        namespacedName: current?.namespacedName ?? safeName(connection.id, capability.upstreamName),
        outputSchema: capability.outputSchema as never,
        upstreamName: capability.upstreamName,
        updatedAt: now,
      }),
    ),
    ...nextCapabilities.map(({ capabilityId }) =>
      db.tx.factoryMcpServers[connection.id].link({
        capabilities: capabilityId,
      }),
    ),
    ...existing
      .filter((c) => !nextKeys.has(`${c.capabilityType}:${c.upstreamName}`))
      .map((c) => db.tx.factoryMcpCapabilities[c.id].delete()),
  ];

  if (transactions.length > 0) {
    await db.transact(transactions);
  }
}

export async function getMcpOauthState(connectionId: string) {
  const result = await db.query({
    factoryMcpOauthStates: {
      $: { where: { connectionId } },
    },
  });

  return result.factoryMcpOauthStates[0] as McpOauthStateRecord | undefined;
}

export async function getMcpOauthStateByState(state: string) {
  const result = await db.query({
    factoryMcpOauthStates: {
      $: { where: { state } },
    },
  });

  return result.factoryMcpOauthStates[0] as McpOauthStateRecord | undefined;
}

export async function upsertMcpOauthState(
  connectionId: string,
  values: Partial<Omit<McpOauthStateRecord, "connectionId" | "createdAt" | "id" | "updatedAt">>,
) {
  const existing = await getMcpOauthState(connectionId);
  const now = new Date().toISOString();
  const stateId = existing?.id ?? id();

  await db.transact(
    db.tx.factoryMcpOauthStates[stateId].update({
      ...values,
      connectionId,
      createdAt: existing?.createdAt ?? now,
      state: values.state ?? existing?.state ?? crypto.randomUUID(),
      updatedAt: now,
    }),
  );

  return getMcpOauthState(connectionId);
}

export async function getMcpBearerToken(connectionId: string) {
  const credential = await getMcpCredential(connectionId);
  return decryptMcpValue<string>(credential?.encryptedBearerToken);
}

export async function upsertMcpBearerToken(connectionId: string, bearerToken: string) {
  const existing = await getMcpCredential(connectionId);
  const credentialId = existing?.id ?? id();
  const now = new Date().toISOString();

  await db.transact(
    db.tx.factoryMcpCredentials[credentialId].update({
      connectionId,
      createdAt: existing?.createdAt ?? now,
      credentialType: "bearer_token",
      encryptedBearerToken: encryptMcpValue(bearerToken),
      updatedAt: now,
    }),
  );
}

async function getMcpCredential(connectionId: string) {
  const result = await db.query({
    factoryMcpCredentials: {
      $: { where: { connectionId } },
    },
  });

  return result.factoryMcpCredentials[0] as McpCredentialRecord | undefined;
}
