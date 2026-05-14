"use client";

import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import { db } from "@/app/lib/instant";
import { id } from "@instantdb/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function FactoryPage() {
  const params = useParams<{ factoryId: string }>();
  const router = useRouter();
  const [runName, setRunName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingNavRef = useRef<string | null>(null);

  const handleCreateRun = useCallback(async () => {
    if (!runName.trim() || !prompt.trim() || submitting) return;

    setSubmitting(true);

    const runId = id();
    const eventId = id();

    await db.transact([
      db.tx.runs[runId]
        .update({
          name: runName.trim(),
          status: "provisioning",
          createdAt: Date.now(),
        })
        .link({ factory: params.factoryId }),
      db.tx.events[eventId]
        .update({
          type: "message",
          data: { text: prompt.trim() },
          createdAt: Date.now(),
        })
        .link({ run: runId }),
    ]);

    fetch("/api/runs/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        factoryId: params.factoryId,
        prompt: prompt.trim(),
      }),
    }).catch(() => {});

    pendingNavRef.current = `/factories/${params.factoryId}/runs/${runId}`;
  }, [runName, prompt, submitting, params.factoryId]);

  return (
    <div
      className="h-full w-full flex flex-col items-center px-3 sm:px-4 pb-3 sm:pb-4"
      style={{ justifyContent: submitting ? "flex-end" : "center" }}
    >
      <AnimatePresence
        mode="popLayout"
        onExitComplete={() => {
          if (pendingNavRef.current) {
            router.push(pendingNavRef.current);
          }
        }}
      >
        {!submitting && (
          <motion.div
            key="hero-text"
            exit={{ opacity: 0, filter: "blur(4px)", y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center mb-6"
          >
            <p className="text font-medium text-grayscale-11">
              Lets Build Something Great!
            </p>
            <p className="text-sm text-grayscale-10">
              We&apos;ll help you build your idea into a reality.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="small-shadow flex flex-col gap-2 w-full max-w-2xl bg-white rounded-xl border border-grayscale-3"
      >
        <Input
          placeholder="Run name"
          variant="underline"
          className="px-3 pt-2"
          value={runName}
          onChange={(e) => setRunName(e.target.value)}
        />
        <textarea
          className="w-full h-full resize-none px-3 text-sm outline-none"
          placeholder="What do you want to build?"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCreateRun();
            }
          }}
        />
        <div className="flex flex-row gap-2 p-2 justify-end">
          <Button
            disabled={!runName.trim() || !prompt.trim() || submitting}
            onClick={handleCreateRun}
          >
            <p>{submitting ? "Creating..." : "Send"}</p>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
