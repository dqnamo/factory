"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import { db } from "@/app/lib/instant";

export default function FactorySettingsPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, error } = db.useQuery(
    factoryId
      ? {
          factories: {
            $: { where: { id: factoryId } },
            runs: {},
            skills: {},
            mcpServers: {},
            factoryUsers: {},
          },
        }
      : null,
  );

  const factory = data?.factories[0];
  const canDelete = confirmName === factory?.name;

  async function handleDelete() {
    if (!factory || !canDelete) return;
    setIsDeleting(true);

    try {
      const txns = [
        ...(factory.runs ?? []).map((r) => db.tx.runs[r.id].delete()),
        ...(factory.skills ?? []).map((s) => db.tx.skills[s.id].delete()),
        ...(factory.mcpServers ?? []).map((m) => db.tx.factoryMcpServers[m.id].delete()),
        ...(factory.factoryUsers ?? []).map((fu) => db.tx.factoryUsers[fu.id].delete()),
        db.tx.factories[factory.id].delete(),
      ];

      await db.transact(txns);
      router.push("/");
    } catch (err) {
      console.error("Failed to delete factory:", err);
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-grayscale-11">
        Loading settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-base font-semibold text-grayscale-12">
            Settings could not be loaded
          </h1>
          <p className="mt-2 text-sm text-grayscale-11">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6">
      <div className="mx-auto flex max-w-2xl flex-col">
        <header className="flex flex-col pb-4 px-4.5">
          <h1 className="font-medium text-grayscale-12">Settings</h1>
          <p className="text-sm text-grayscale-11">Manage your factory settings.</p>
        </header>

        <div className="bg-grayscale-1 w-full rounded-[16px] small-shadow border border-grayscale-3 p-1.5">
          <div className="bg-grayscale-1 w-full rounded-[13px]">
            <div className="flex flex-col p-3">
              <h2 className="font-medium text-sm text-grayscale-12">Delete factory</h2>
              <p className="text-xs text-grayscale-11 mt-1">
                Permanently delete <span className="font-medium text-grayscale-12">{factory?.name}</span> and
                all of its runs, skills, and MCP servers. This action cannot be undone.
              </p>
            </div>

            <div className="border-t border-grayscale-3 p-3">
              <label
                htmlFor="confirm-name"
                className="text-xs text-grayscale-11 block mb-1.5"
              >
                Type <span className="font-medium text-grayscale-12">{factory?.name}</span> to
                confirm
              </label>
              <Input
                id="confirm-name"
                variant="border"
                className="rounded-lg border-grayscale-5! p-2! text-sm"
                placeholder={factory?.name}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={isDeleting}
              />
            </div>

            <div className="flex flex-row p-2 justify-end border-t border-grayscale-3">
              <Button
                variant="primary"
                className="bg-red-9! border-red-9! hover:bg-red-10! hover:border-red-10!"
                disabled={!canDelete || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "Deleting..." : "Delete factory"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
