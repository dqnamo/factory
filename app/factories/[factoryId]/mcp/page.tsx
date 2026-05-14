"use client";

import { ArrowsClockwiseIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import Switch from "@/app/components/Switch";
import { cn } from "@/app/helpers/ui-helper";
import { authFetch } from "@/app/lib/auth-fetch";
import { db } from "@/app/lib/instant";

type McpAuthType = "bearer_token" | "oauth";

type McpCapability = {
  capabilityType: string;
  description?: string | null;
  enabled: boolean;
  id: string;
  mcpServerId: string;
  namespacedName: string;
  upstreamName: string;
};

type McpServer = {
  authType?: McpAuthType | string;
  authStatus?: string;
  capabilities?: McpCapability[];
  enabled?: boolean;
  id: string;
  lastError?: string | null;
  loginUrl?: string | null;
  name: string;
  status: string;
  syncStatus?: string;
  url: string;
};

export default function FactoryMcpPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpAuthType, setMcpAuthType] = useState<McpAuthType>("bearer_token");
  const [mcpBearerToken, setMcpBearerToken] = useState("");
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpNotice, setMcpNotice] = useState<string | null>(null);
  const [mcpAuthUrl, setMcpAuthUrl] = useState<string | null>(null);
  const [isSavingMcp, setIsSavingMcp] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [optimisticServerEnabledById, setOptimisticServerEnabledById] = useState<
    Record<string, boolean>
  >({});
  const [optimisticToolEnabledById, setOptimisticToolEnabledById] = useState<
    Record<string, boolean>
  >({});

  const { data, isLoading, error } = db.useQuery(
    factoryId
      ? {
          factories: {
            $: { where: { id: factoryId } },
            mcpServers: {
              capabilities: {},
            },
          },
        }
      : null,
  );

  const factory = data?.factories[0];
  const mcpServers = useMemo(
    () =>
      ([...(factory?.mcpServers ?? [])] as McpServer[])
        .map((server) => ({
          ...server,
          capabilities: [...(server.capabilities ?? [])].sort((a, b) =>
            a.upstreamName.localeCompare(b.upstreamName),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [factory?.mcpServers],
  );

  useEffect(() => {
    setOptimisticServerEnabledById((current) => {
      let changed = false;
      const next = { ...current };

      for (const server of mcpServers) {
        if (next[server.id] === (server.enabled !== false)) {
          delete next[server.id];
          changed = true;
        }
      }

      return changed ? next : current;
    });

    setOptimisticToolEnabledById((current) => {
      let changed = false;
      const next = { ...current };

      for (const server of mcpServers) {
        for (const tool of server.capabilities ?? []) {
          if (next[tool.id] === tool.enabled) {
            delete next[tool.id];
            changed = true;
          }
        }
      }

      return changed ? next : current;
    });
  }, [mcpServers]);

  async function handleAddMcp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = mcpName.trim();
    const url = mcpUrl.trim();

    if (!name || !url) {
      setMcpError("Enter an MCP server name and URL.");
      return;
    }

    if (mcpAuthType === "bearer_token" && !mcpBearerToken.trim()) {
      setMcpError("Enter a bearer token for this MCP server.");
      return;
    }

    setMcpError(null);
    setMcpNotice(null);
    setMcpAuthUrl(null);
    setIsSavingMcp(true);

    try {
      const response = await authFetch(`/api/factories/${factoryId}/mcp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authType: mcpAuthType,
          bearerToken: mcpAuthType === "bearer_token" ? mcpBearerToken.trim() : undefined,
          name,
          url,
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "MCP setup could not be started.");
      }

      if (body?.authUrl) {
        setMcpAuthUrl(body.authUrl);
      } else {
        setMcpNotice("MCP server connected.");
      }

      setMcpName("");
      setMcpUrl("");
      setMcpBearerToken("");
    } catch (error) {
      console.error(error);
      setMcpError(error instanceof Error ? error.message : "MCP server could not be added.");
    } finally {
      setIsSavingMcp(false);
    }
  }

  async function handleSyncMcp(serverId: string) {
    setActionId(serverId);
    setMcpError(null);
    setMcpNotice(null);
    setMcpAuthUrl(null);

    try {
      const response = await authFetch(`/api/factories/${factoryId}/mcp/${serverId}/sync`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "MCP sync failed.");
      }

      if (body?.authUrl) {
        setMcpAuthUrl(body.authUrl);
      } else {
        setMcpNotice("MCP server synced.");
      }
    } catch (error) {
      console.error(error);
      setMcpError(error instanceof Error ? error.message : "MCP sync failed.");
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleMcp(server: McpServer, enabled: boolean) {
    const previousEnabled = optimisticServerEnabledById[server.id] ?? server.enabled !== false;

    setOptimisticServerEnabledById((current) => ({
      ...current,
      [server.id]: enabled,
    }));
    setActionId(server.id);
    setMcpError(null);
    setMcpNotice(null);

    try {
      await db.transact(db.tx.factoryMcpServers[server.id].update({ enabled }));
    } catch (error) {
      console.error(error);
      setOptimisticServerEnabledById((current) => ({
        ...current,
        [server.id]: previousEnabled,
      }));
      setMcpError(error instanceof Error ? error.message : "MCP update failed.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeleteMcp(serverId: string) {
    setActionId(serverId);
    setMcpError(null);
    setMcpNotice(null);

    try {
      await db.transact(db.tx.factoryMcpServers[serverId].delete());
    } catch (error) {
      console.error(error);
      setMcpError(error instanceof Error ? error.message : "MCP server could not be removed.");
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleMcpCapability(capability: McpCapability, enabled: boolean) {
    const previousEnabled = optimisticToolEnabledById[capability.id] ?? capability.enabled;

    setOptimisticToolEnabledById((current) => ({
      ...current,
      [capability.id]: enabled,
    }));
    setActionId(capability.id);
    setMcpError(null);
    setMcpNotice(null);

    try {
      await db.transact(db.tx.factoryMcpCapabilities[capability.id].update({ enabled }));
    } catch (error) {
      console.error(error);
      setOptimisticToolEnabledById((current) => ({
        ...current,
        [capability.id]: previousEnabled,
      }));
      setMcpError(error instanceof Error ? error.message : "Tool update failed.");
    } finally {
      setActionId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-grayscale-11">
        Loading MCP servers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-base font-semibold text-grayscale-12">MCP could not be loaded</h1>
          <p className="mt-2 text-sm text-grayscale-11">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6">
      <div className="mx-auto flex max-w-2xl flex-col">
        <header className="flex flex-col pb-4 px-4.5">
          <div className="flex flex-col">
            <h1 className="font-medium text-grayscale-12">MCP</h1>
            <p className="text-sm text-grayscale-11">
              Connect MCP servers and control the tools available to new runs.
            </p>
          </div>
        </header>

        <div className="bg-grayscale-2 border border-grayscale-3 rounded-[16px] p-1.5">
          <div className="bg-grayscale-1 w-full rounded-[13px] small-shadow border border-grayscale-3">
            <form autoComplete="off" onSubmit={handleAddMcp}>
              <div className="flex flex-col p-3">
                <h2 className="font-medium text-sm text-grayscale-11">Connect MCP server</h2>
                <p className="text-xs text-grayscale-11">Add an MCP endpoint to this factory.</p>
              </div>
              <Input
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                disabled={isSavingMcp}
                name="mcp-server-name"
                onChange={(event) => setMcpName(event.target.value)}
                placeholder="linear"
                value={mcpName}
              />
              <Input
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                disabled={isSavingMcp}
                inputMode="url"
                name="mcp-server-url"
                onChange={(event) => setMcpUrl(event.target.value)}
                placeholder="https://example.com/mcp"
                value={mcpUrl}
              />
              <div className="grid grid-cols-2 border-b border-grayscale-3">
                {(["bearer_token", "oauth"] as const).map((authType) => (
                  <button
                    key={authType}
                    type="button"
                    className={cn(
                      "border-r border-grayscale-3 px-3 py-2 text-xs font-medium transition-colors last:border-r-0",
                      mcpAuthType === authType
                        ? "bg-grayscale-12 text-grayscale-1"
                        : "bg-grayscale-1 text-grayscale-11 hover:bg-grayscale-2",
                    )}
                    disabled={isSavingMcp}
                    onClick={() => setMcpAuthType(authType)}
                  >
                    {authType === "oauth" ? "OAuth" : "Bearer token"}
                  </button>
                ))}
              </div>
              {mcpAuthType === "bearer_token" ? (
                <Input
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  disabled={isSavingMcp}
                  name="mcp-bearer-token"
                  onChange={(event) => setMcpBearerToken(event.target.value)}
                  placeholder="Bearer token"
                  type="password"
                  value={mcpBearerToken}
                />
              ) : null}
              <div className="flex flex-row p-2 justify-end">
                <Button variant="primary" type="submit" disabled={isSavingMcp}>
                  {isSavingMcp ? "Connecting..." : "Connect"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {mcpAuthUrl ? (
          <div className="mx-1.5 mt-3 rounded-lg border border-accent-6 bg-accent-3 px-3 py-2 text-sm text-accent-11">
            <a href={mcpAuthUrl} target="_blank" rel="noreferrer" className="hover:underline">
              Open MCP OAuth login to authorize
            </a>
          </div>
        ) : null}

        {mcpError ? (
          <div className="mx-1.5 mt-3 rounded-lg border border-red-6 bg-red-3 px-3 py-2 text-sm text-red-11">
            {mcpError}
          </div>
        ) : null}

        {mcpNotice ? (
          <div className="mx-1.5 mt-3 rounded-lg border border-grayscale-5 bg-grayscale-3 px-3 py-2 text-sm text-grayscale-11">
            {mcpNotice}
          </div>
        ) : null}

        <div className="flex flex-col px-4.5 py-4">
          <h1 className="font-medium text-grayscale-12">Connected Servers</h1>
          <p className="text-sm text-grayscale-11">MCP servers available to this factory.</p>
        </div>
        <div className="bg-grayscale-2 border border-grayscale-3 rounded-[16px] p-1.5">
          <div className="bg-grayscale-1 w-full rounded-[13px] small-shadow border border-grayscale-3">
            {mcpServers.length === 0 ? (
              <div className="p-6 text-center text-sm text-grayscale-10">
                No MCP servers connected yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-grayscale-3">
                {mcpServers.map((server) => {
                  const enabled =
                    optimisticServerEnabledById[server.id] ?? server.enabled !== false;
                  const isBusy = actionId === server.id;
                  const tools = (server.capabilities ?? []).filter(
                    (capability) => capability.capabilityType === "tool",
                  );

                  return (
                    <div key={server.id} className="flex flex-col">
                      <div className="flex flex-row items-start justify-between gap-3 p-3">
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-2">
                            {getServerStatusLabel(server, enabled) === "failed" ? (
                              <WarningCircleIcon
                                size={14}
                                weight="fill"
                                className="text-red-10"
                                aria-hidden="true"
                              />
                            ) : null}
                            <h2 className="truncate font-medium text-sm text-grayscale-11">
                              {server.name}
                            </h2>
                          </div>
                          <p className="truncate text-xs text-grayscale-11">{server.url}</p>
                          <p className="mt-1 text-[11px] text-grayscale-10">
                            {server.authType === "bearer_token" ? "Bearer token" : "OAuth"} ·{" "}
                            {getServerStatusLabel(server, enabled)}
                          </p>
                          {server.authStatus === "authorization_required" && server.loginUrl ? (
                            <a
                              href={server.loginUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 text-xs font-medium text-accent-11 hover:text-accent-12"
                            >
                              Open OAuth login
                            </a>
                          ) : null}
                          {server.lastError ? (
                            <p className="mt-2 text-xs text-red-11">{server.lastError}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Switch
                            aria-label={`${enabled ? "Disable" : "Enable"} ${server.name}`}
                            checked={enabled}
                            disabled={isBusy}
                            onCheckedChange={(nextChecked) =>
                              void handleToggleMcp(server, nextChecked)
                            }
                          />
                          <Button
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => void handleSyncMcp(server.id)}
                          >
                            <ArrowsClockwiseIcon size={14} weight="bold" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => void handleDeleteMcp(server.id)}
                          >
                            <TrashIcon size={14} weight="bold" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                      {tools.length > 0 ? (
                        <div className="border-t border-grayscale-3 bg-grayscale-2/40">
                          {tools.map((tool) => {
                            const toolEnabled = optimisticToolEnabledById[tool.id] ?? tool.enabled;

                            return (
                              <div
                                key={tool.id}
                                className="flex items-start justify-between gap-3 border-b border-grayscale-3 px-3 py-2 last:border-b-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-grayscale-12">
                                    {tool.upstreamName}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-grayscale-10">
                                    {tool.namespacedName}
                                  </p>
                                  {tool.description ? (
                                    <p className="mt-1 line-clamp-2 text-xs text-grayscale-11">
                                      {tool.description}
                                    </p>
                                  ) : null}
                                </div>
                                <Switch
                                  aria-label={`${toolEnabled ? "Disable" : "Enable"} ${
                                    tool.upstreamName
                                  }`}
                                  checked={toolEnabled}
                                  disabled={actionId === tool.id}
                                  onCheckedChange={(nextChecked) =>
                                    void handleToggleMcpCapability(tool, nextChecked)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getServerStatusLabel(server: McpServer, enabled: boolean) {
  if (!enabled) return "disabled";
  if (server.authStatus === "authorization_required") return "auth required";
  if (server.status === "failed" || server.syncStatus === "failed") return "failed";
  if (server.status === "authenticated" || server.syncStatus === "ready") return "connected";
  if (server.status === "pending" || server.syncStatus === "pending") return "syncing";
  return "pending";
}
