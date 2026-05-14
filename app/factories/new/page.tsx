"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Button from "../../components/Button";
import Input from "../../components/Input";
import ModalDrawer from "../../components/ModalDrawer";
import { authFetch } from "../../lib/auth-fetch";
import { db } from "../../lib/instant";

type CodexStatus = "idle" | "starting" | "pending" | "authenticated" | "failed";
type CursorStatus = "idle" | "connecting" | "authenticated" | "failed";
type Engine = "codex" | "cursor";

const defaultVerificationUrl = "https://auth.openai.com/codex/device";

export default function NewFactoryPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [factoryName, setFactoryName] = useState("");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<Engine | null>(null);

  const [codexModalOpen, setCodexModalOpen] = useState(false);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [codexCode, setCodexCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState(defaultVerificationUrl);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>("idle");
  const [codexError, setCodexError] = useState<string | null>(null);

  const [cursorModalOpen, setCursorModalOpen] = useState(false);
  const [cursorApiKey, setCursorApiKey] = useState("");
  const [cursorBoxId, setCursorBoxId] = useState<string | null>(null);
  const [cursorStatus, setCursorStatus] = useState<CursorStatus>("idle");
  const [cursorError, setCursorError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (codexStatus !== "pending" || !boxId) return;

    const controller = new AbortController();

    const pollStatus = async () => {
      const response = await authFetch(`/api/codex-connect?boxId=${encodeURIComponent(boxId)}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not check Codex login status.");
      }

      if (data.status === "authenticated") {
        setCodexStatus("authenticated");
        setSelectedEngine("codex");
        return;
      }

      if (data.status === "failed" || data.status === "stale") {
        setCodexStatus("failed");
        setCodexError("The Codex login attempt expired. Try creating a new code.");
      }
    };

    pollStatus().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setCodexStatus("failed");
        setCodexError(error instanceof Error ? error.message : "Could not check status.");
      }
    });

    const intervalId = window.setInterval(() => {
      pollStatus().catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCodexStatus("failed");
          setCodexError(error instanceof Error ? error.message : "Could not check status.");
        }
      });
    }, 3000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [boxId, codexStatus]);

  const handleStartCodexLogin = useCallback(async () => {
    setCodexStatus("starting");
    setCodexError(null);
    setCodexCode(null);

    try {
      const response = await authFetch("/api/codex-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCodexStatus("failed");
        setCodexError(data.error ?? "Could not start Codex device login.");
        return;
      }

      if (data.status === "authenticated") {
        setCodexStatus("authenticated");
        setBoxId(data.boxId);
        setSelectedEngine("codex");
        return;
      }

      if (data.code) {
        setCodexCode(data.code);
        setBoxId(data.boxId);
        setVerificationUrl(data.verificationUrl ?? defaultVerificationUrl);
        setCodexStatus("pending");
        return;
      }

      setCodexStatus("failed");
      setCodexError("Codex did not return a device code.");
    } catch (error) {
      setCodexStatus("failed");
      setCodexError(error instanceof Error ? error.message : "Could not start Codex device login.");
    }
  }, [boxId]);

  const handleConnectCursor = useCallback(async () => {
    if (!cursorApiKey.trim()) return;

    setCursorStatus("connecting");
    setCursorError(null);

    try {
      const response = await authFetch("/api/cursor-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursorApiKey: cursorApiKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCursorStatus("failed");
        setCursorError(data.error ?? "Could not connect Cursor.");
        return;
      }

      if (data.status === "authenticated") {
        setCursorBoxId(data.boxId);
        setCursorStatus("authenticated");
        setSelectedEngine("cursor");
        return;
      }

      setCursorStatus("failed");
      setCursorError("Unexpected response from Cursor connect.");
    } catch (error) {
      setCursorStatus("failed");
      setCursorError(error instanceof Error ? error.message : "Could not connect Cursor.");
    }
  }, [cursorApiKey]);

  const activeBoxId = selectedEngine === "cursor" ? cursorBoxId : boxId;
  const isAgentConnected =
    (selectedEngine === "codex" && codexStatus === "authenticated") ||
    (selectedEngine === "cursor" && cursorStatus === "authenticated");

  const handleCreateFactory = useCallback(async () => {
    if (!user || !activeBoxId || !selectedEngine || !githubRepoUrl.trim() || !githubToken.trim()) {
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const response = await authFetch("/api/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursorApiKey: selectedEngine === "cursor" ? cursorApiKey.trim() : undefined,
          engine: selectedEngine,
          factoryName,
          githubRepoUrl: githubRepoUrl.trim(),
          githubToken: githubToken.trim(),
          sandboxId: activeBoxId,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Factory could not be created.");
      }

      const body = (await response.json()) as { factoryId: string };

      router.replace(`/factories/${body.factoryId}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Factory could not be created.");
      setCreating(false);
    }
  }, [
    user,
    activeBoxId,
    selectedEngine,
    factoryName,
    githubRepoUrl,
    githubToken,
    cursorApiKey,
    router,
  ]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full p-4 md:p-8 lg:p-16 h-full overflow-y-auto">
      <div className="p-3 mb-8">
        <p className="text-sm text-grayscale-12">Create a new factory</p>
        <p className="text-sm text-grayscale-11">Set up your factory in a few steps.</p>
      </div>

      <div className="grid grid-cols-3 px-3 gap-2 mb-2">
        <div className={`h-1 w-full rounded-xl ${step >= 0 ? "bg-accent-9" : "bg-grayscale-3"}`} />
        <div className={`h-1 w-full rounded-xl ${step >= 1 ? "bg-accent-9" : "bg-grayscale-3"}`} />
        <div className={`h-1 w-full rounded-xl ${step >= 2 ? "bg-accent-9" : "bg-grayscale-3"}`} />
      </div>

      {step === 0 && (
        <div className="bg-white rounded-lg border border-grayscale-3">
          <div className="px-3 pt-3">
            <p className="text-sm font-medium text-grayscale-12">Name your factory</p>
            <p className="text-xs text-grayscale-11 mt-0.5">Give it something memorable.</p>
          </div>
          <Input
            variant="underline"
            className="w-full px-3 py-2"
            placeholder="My Factory"
            value={factoryName}
            onChange={(e) => setFactoryName(e.target.value)}
          />
          <div className="flex flex-row gap-2 p-2 justify-end">
            <Button variant="primary" disabled={!factoryName.trim()} onClick={() => setStep(1)}>
              <p>Next</p>
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-lg border border-grayscale-3">
          <div className="px-3 pt-3">
            <p className="text-sm font-medium text-grayscale-12">Connect a coding agent</p>
            <p className="text-xs text-grayscale-11 mt-0.5">
              Choose the coding agent that will power your factory.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-3 max-sm:*:aspect-auto">
            <ModalDrawer
              open={codexModalOpen}
              onOpenChange={setCodexModalOpen}
              aria-label="Connect Codex"
              trigger={
                <div className="flex flex-col bg-grayscale-2 rounded-lg hover:bg-grayscale-3 transition-colors items-center justify-center p-2 text-center w-full h-full">
                  <div className="flex items-center justify-center rounded-xl border border-grayscale-3 bg-white p-2 small-shadow">
                    <Image
                      src="/codex-logo.png"
                      alt="Codex"
                      width={100}
                      height={100}
                      className="w-8 invert"
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-grayscale-12">Codex</p>
                  {codexStatus === "authenticated" ? (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="size-1.5 rounded-full bg-green-9" />
                      <p className="text-[10px] text-green-11">Connected</p>
                    </div>
                  ) : null}
                </div>
              }
            >
              <div className="flex flex-col w-full">
                <div className="flex flex-col gap-px px-3 pt-3">
                  <p className="text-sm font-semibold text-grayscale-12">Connect Codex</p>
                  <p className="text-xs text-grayscale-11 mt-1">
                    We use OpenAI&apos;s device code authentication to connect Codex.
                  </p>
                  <p className="text-xs text-grayscale-11 mt-3">
                    First, enable device code login in your{" "}
                    <a
                      href="https://chatgpt.com/#settings/Security"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-9 hover:text-accent-10 underline"
                    >
                      ChatGPT security settings
                    </a>
                    .
                  </p>
                </div>

                <div className="px-3 py-3">
                  {(codexStatus === "idle" || codexStatus === "failed") && (
                    <div className="flex flex-col gap-2">
                      {codexError && <p className="text-xs text-red-11">{codexError}</p>}
                      <Button variant="secondary" onClick={handleStartCodexLogin}>
                        <p>{codexStatus === "failed" ? "Try again" : "Create device code"}</p>
                      </Button>
                    </div>
                  )}

                  {codexStatus === "starting" && (
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-accent-9 animate-pulse" />
                      <p className="text-sm text-grayscale-11">Starting Codex login...</p>
                    </div>
                  )}

                  {codexStatus === "pending" && codexCode && (
                    <div className="rounded-lg border border-grayscale-3 bg-grayscale-2 p-3">
                      <p className="text-xs text-grayscale-11 text-center">
                        Go to{" "}
                        <a
                          href={verificationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-9 hover:text-accent-10 underline"
                        >
                          OpenAI device auth
                        </a>
                      </p>
                      <p className="mt-1 text-[10px] text-grayscale-10 text-center">
                        Enter this one-time code to connect Codex.
                      </p>
                      <p className="text-2xl font-semibold text-grayscale-12 text-center mt-3 tracking-wide font-mono">
                        {codexCode}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <div className="size-2 rounded-full bg-amber-9 animate-pulse" />
                        <p className="text-[10px] text-grayscale-10">
                          Waiting for OpenAI to confirm...
                        </p>
                      </div>
                    </div>
                  )}

                  {codexStatus === "authenticated" && (
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-green-9" />
                      <p className="text-sm text-grayscale-12 font-medium">Codex connected</p>
                    </div>
                  )}
                </div>
              </div>
            </ModalDrawer>

            <ModalDrawer
              open={cursorModalOpen}
              onOpenChange={setCursorModalOpen}
              aria-label="Connect Cursor"
              trigger={
                <div className="flex flex-col bg-grayscale-2 rounded-lg hover:bg-grayscale-3 transition-colors items-center justify-center p-2 text-center w-full h-full">
                  <div className="flex items-center justify-center rounded-xl border border-grayscale-3 bg-white p-2 small-shadow">
                    <Image
                      src="/cursor-logo.png"
                      alt="Cursor"
                      width={100}
                      height={100}
                      className="w-8"
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-grayscale-12">Cursor</p>
                  {cursorStatus === "authenticated" ? (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="size-1.5 rounded-full bg-green-9" />
                      <p className="text-[10px] text-green-11">Connected</p>
                    </div>
                  ) : null}
                </div>
              }
            >
              <div className="flex flex-col w-full">
                <div className="flex flex-col gap-px px-3 pt-3">
                  <p className="text-sm font-semibold text-grayscale-12">Connect Cursor</p>
                  <p className="text-xs text-grayscale-11 mt-1">
                    Use the Cursor Agent headless CLI to power your factory runs.
                  </p>
                  <p className="text-xs text-grayscale-11 mt-3">
                    Generate an API key from your{" "}
                    <a
                      href="https://cursor.com/dashboard/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-9 hover:text-accent-10 underline"
                    >
                      Cursor Dashboard
                    </a>{" "}
                    under Integrations &rarr; API Keys.
                  </p>
                </div>

                <div className="px-3 py-3">
                  {(cursorStatus === "idle" || cursorStatus === "failed") && (
                    <div className="flex flex-col gap-2">
                      {cursorError && <p className="text-xs text-red-11">{cursorError}</p>}
                      <Input
                        variant="underline"
                        className="w-full"
                        placeholder="cursor_..."
                        type="password"
                        value={cursorApiKey}
                        onChange={(e) => setCursorApiKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleConnectCursor();
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        disabled={!cursorApiKey.trim()}
                        onClick={handleConnectCursor}
                      >
                        <p>{cursorStatus === "failed" ? "Try again" : "Connect"}</p>
                      </Button>
                    </div>
                  )}

                  {cursorStatus === "connecting" && (
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-accent-9 animate-pulse" />
                      <p className="text-sm text-grayscale-11">Setting up Cursor sandbox...</p>
                    </div>
                  )}

                  {cursorStatus === "authenticated" && (
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-green-9" />
                      <p className="text-sm text-grayscale-12 font-medium">Cursor connected</p>
                    </div>
                  )}
                </div>
              </div>
            </ModalDrawer>

            <div className="flex aspect-square flex-col items-center justify-center rounded-xl bg-grayscale-1 p-2 text-center opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-center rounded-xl border border-grayscale-3 bg-white p-2 small-shadow">
                <Image
                  src="/claude-logo.svg"
                  alt="Claude"
                  width={100}
                  height={100}
                  className="w-8"
                />
              </div>
              <p className="mt-2 text-xs font-medium text-grayscale-12">Claude</p>
            </div>
          </div>

          {createError ? <p className="px-3 pb-2 text-xs text-red-500">{createError}</p> : null}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:justify-between border-t border-grayscale-3">
            <p className="text-[10px] text-grayscale-10 px-1">
              Connect at least one agent to continue.
            </p>
            <div className="flex flex-row gap-2 justify-end">
              <Button variant="secondary" onClick={() => setStep(0)}>
                <p>Back</p>
              </Button>
              <Button variant="primary" disabled={!isAgentConnected} onClick={() => setStep(2)}>
                <p>Next</p>
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-lg border border-grayscale-3">
          <div className="px-3 pt-3">
            <p className="text-sm font-medium text-grayscale-12">Connect GitHub</p>
            <p className="text-xs text-grayscale-11 mt-0.5">
              Add the repository this factory should clone and keep fresh.
            </p>
          </div>

          <div className="flex flex-col">
            <Input
              variant="underline"
              className="w-full px-3 py-2"
              placeholder="https://github.com/org/repo"
              value={githubRepoUrl}
              onChange={(e) => setGithubRepoUrl(e.target.value)}
            />
            <Input
              variant="underline"
              className="w-full px-3 py-2"
              placeholder="github_pat_..."
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateFactory();
                }
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:justify-between border-t border-grayscale-3">
            <p className="text-[10px] text-grayscale-10 px-1">
              The base sandbox clones this repo, and new run sandboxes pull latest before starting.
            </p>
            <div className="flex flex-row gap-2 justify-end">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <p>Back</p>
              </Button>
              <Button
                variant="primary"
                disabled={!githubRepoUrl.trim() || !githubToken.trim() || creating}
                onClick={handleCreateFactory}
              >
                <p>{creating ? "Creating..." : "Create Factory"}</p>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
