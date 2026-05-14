"use client";

import { id } from "@instantdb/react";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import Button from "@/app/components/Button";
import RunStatusGrid from "@/app/components/RunStatusGrid";
import { authFetch } from "@/app/lib/auth-fetch";
import { db } from "@/app/lib/instant";

type QueuedMessage = {
  id: string;
  text: string;
};

export default function RunPage() {
  const params = useParams<{ factoryId: string; runId: string }>();
  const [followUp, setFollowUp] = useState("");
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = db.useQuery({
    runs: {
      $: { where: { id: params.runId } },
      events: {},
    },
  });

  const run = data?.runs[0];
  const events = run?.events
    ? [...run.events].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    : [];

  const eventCount = events.length;
  const queueCount = queue.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when new events or queued messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventCount, queueCount]);

  const sendMessage = useCallback(
    async (text: string) => {
      const eventId = id();

      await db.transact([
        db.tx.runs[params.runId]
          .ruleParams({ factoryId: params.factoryId })
          .update({ status: "running" }),
        db.tx.events[eventId]
          .ruleParams({ factoryId: params.factoryId })
          .update({
            type: "message",
            data: { text },
            createdAt: Date.now(),
          })
          .link({ run: params.runId }),
      ]);

      authFetch("/api/runs/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: params.runId,
          factoryId: params.factoryId,
          prompt: text,
        }),
      }).catch(() => {});
    },
    [params.runId, params.factoryId],
  );

  const handleSendFollowUp = useCallback(async () => {
    if (!followUp.trim() || sending) return;
    if (!run) return;

    setSending(true);
    const text = followUp.trim();
    setFollowUp("");
    await sendMessage(text);
    setSending(false);
  }, [followUp, sending, run, sendMessage]);

  const handleQueueMessage = useCallback(() => {
    if (!followUp.trim()) return;
    setQueue((prev) => [...prev, { id: id(), text: followUp.trim() }]);
    setFollowUp("");
  }, [followUp]);

  // Auto-send next queued message when run becomes idle
  const draining = useRef(false);
  const prevStatus = useRef(run?.status);
  useEffect(() => {
    const wasbusy = prevStatus.current === "running" || prevStatus.current === "provisioning";
    const isIdle = run?.status === "idle";
    prevStatus.current = run?.status;

    if (!wasbusy || !isIdle) return;
    if (queue.length === 0 || draining.current) return;

    draining.current = true;
    const next = queue[0];
    // Defer the state update to avoid synchronous setState in effect
    queueMicrotask(() => {
      setQueue((prev) => prev.slice(1));
      sendMessage(next.text).finally(() => {
        draining.current = false;
      });
    });
  }, [run?.status, queue, sendMessage]);

  const handleToggleCompleted = useCallback(async () => {
    const newStatus = run?.status === "completed" ? "idle" : "completed";
    await db.transact(
      db.tx.runs[params.runId]
        .ruleParams({ factoryId: params.factoryId })
        .update({ status: newStatus }),
    );
  }, [params.factoryId, params.runId, run?.status]);

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <CircleNotchIcon size={20} weight="bold" className="text-grayscale-10 animate-spin" />
      </div>
    );
  }

  const isRunning = run.status === "running" || run.status === "provisioning";

  return (
    <div className="h-full w-full relative flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-grayscale-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-grayscale-12 truncate">
            {run.name || "Untitled run"}
          </p>
          <RunStatusGrid status={run.status ?? "unknown"} />
        </div>
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={handleToggleCompleted}
          disabled={run.status === "running" || run.status === "provisioning"}
        >
          <p className="text-xs whitespace-nowrap">
            {run.status === "completed" ? "Mark Incomplete" : "Mark Completed"}
          </p>
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-4 px-4 flex flex-col gap-3">
          {events.map((event) => {
            if (event.type === "message") {
              const text = (event.data as { text?: string })?.text ?? "";
              return (
                <div key={event.id} className="flex flex-col gap-0.5 self-end max-w-md">
                  <p className="text-[10px] font-mono font-semibold text-grayscale-10 uppercase text-right">
                    You
                  </p>
                  <div className="text-sm text-grayscale-12 text-right">
                    <Streamdown linkSafety={{ enabled: false }}>{text}</Streamdown>
                  </div>
                </div>
              );
            }

            if (event.type === "item.completed") {
              const item = (event.data as { item?: { type?: string; text?: string } })?.item;
              if (item?.type === "agent_message" && item.text) {
                return (
                  <div key={event.id} className="flex flex-col gap-0.5 self-start max-w-md">
                    <p className="text-[10px] font-mono font-semibold text-grayscale-10 uppercase">
                      Agent
                    </p>
                    <div className="text-sm text-grayscale-12">
                      <Streamdown linkSafety={{ enabled: false }}>{item.text}</Streamdown>
                    </div>
                  </div>
                );
              }
            }

            if (event.type === "cursor.tool_call.started") {
              const data = event.data as { toolName?: string } | null;
              return (
                <div key={event.id} className="flex items-center gap-1.5 px-3 py-1.5 max-w-md">
                  <div className="size-1.5 rounded-full bg-accent-9" />
                  <p className="text-[10px] font-mono text-grayscale-10">
                    {data?.toolName ?? "tool"}
                  </p>
                </div>
              );
            }

            if (event.type === "cursor.tool_call.completed") {
              return null;
            }

            if (event.type === "cursor.result") {
              const data = event.data as { durationMs?: number } | null;
              return (
                <div key={event.id} className="flex items-center gap-1.5 px-3 py-1.5 max-w-md">
                  <div className="size-1.5 rounded-full bg-green-9" />
                  <p className="text-[10px] font-mono text-grayscale-10">
                    Completed
                    {data?.durationMs ? ` in ${(data.durationMs / 1000).toFixed(1)}s` : ""}
                  </p>
                </div>
              );
            }

            if (event.type === "cursor.system") {
              const data = event.data as { model?: string } | null;
              return (
                <div key={event.id} className="flex items-center gap-1.5 px-3 py-1.5 max-w-md">
                  <div className="size-1.5 rounded-full bg-grayscale-8" />
                  <p className="text-[10px] font-mono text-grayscale-10">
                    Cursor Agent{data?.model ? ` · ${data.model}` : ""}
                  </p>
                </div>
              );
            }

            if (event.type === "error") {
              const msg = (event.data as { message?: string })?.message ?? "Unknown error";
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 bg-red-3 rounded-lg px-3 py-2 max-w-md"
                >
                  <p className="text-xs font-mono text-red-11">{msg}</p>
                </div>
              );
            }

            const eventData = event.data as Record<string, unknown> | null;
            return (
              <div
                key={event.id}
                className="flex flex-col gap-1 bg-grayscale-2 rounded-lg px-3 py-2 max-w-md"
              >
                <p className="text-[10px] font-mono font-semibold text-grayscale-10 uppercase">
                  {event.type ?? "event"}
                </p>
                {eventData && (
                  <pre className="text-xs text-grayscale-11 whitespace-pre-wrap break-all overflow-hidden">
                    {JSON.stringify(eventData, null, 2)}
                  </pre>
                )}
                {event.createdAt && (
                  <p className="text-[10px] text-grayscale-9">
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                )}
              </div>
            );
          })}

          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-2">
              <CircleNotchIcon size={14} weight="bold" className="text-grayscale-10 animate-spin" />
              <p className="text-xs text-grayscale-10">
                {run.status === "provisioning" ? "Provisioning sandbox..." : "Agent is working..."}
              </p>
            </div>
          )}

          {queue.map((message) => (
            <div key={message.id} className="flex flex-col gap-0.5 self-end max-w-md opacity-50">
              <p className="text-[10px] font-mono font-semibold text-grayscale-10 uppercase text-right">
                Queued
              </p>
              <p className="text-sm text-grayscale-11 text-right">{message.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="small-shadow flex flex-col gap-2 max-w-2xl mx-auto bg-white rounded-xl border border-grayscale-3">
          <textarea
            className="w-full h-full resize-none p-3 text-sm outline-none rounded-xl"
            placeholder="Send a follow-up message..."
            rows={3}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                handleSendFollowUp();
              }
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                handleQueueMessage();
              }
            }}
          />
          <div className="flex flex-row gap-2 p-2 justify-end items-end">
            <Button disabled={!followUp.trim() || sending} onClick={handleSendFollowUp}>
              <p>{sending ? "Sending..." : "Send"}</p>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
