"use client";

import { TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import Switch from "@/app/components/Switch";
import { authFetch } from "@/app/lib/auth-fetch";
import { db } from "@/app/lib/instant";

type SkillItem = {
  id: string;
  installedAt?: string | null;
  lastError?: string | null;
  name: string;
  repoUrl: string;
  skillPath?: string | null;
  status: string;
};

function removeOptimisticValue(values: Record<string, boolean>, id: string) {
  if (!(id in values)) return values;

  const next = { ...values };
  delete next[id];
  return next;
}

export default function FactorySkillsPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const [repoUrl, setRepoUrl] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillNotice, setSkillNotice] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [actionSkillId, setActionSkillId] = useState<string | null>(null);
  const [optimisticEnabledById, setOptimisticEnabledById] = useState<Record<string, boolean>>({});
  const { data, isLoading, error } = db.useQuery(
    factoryId
      ? {
          factories: {
            $: { where: { id: factoryId } },
            skills: {},
          },
        }
      : null,
  );
  const factory = data?.factories[0];
  const skills = useMemo(
    () =>
      ([...(factory?.skills ?? [])] as SkillItem[]).sort((a, b) =>
        (a.installedAt ?? "").localeCompare(b.installedAt ?? ""),
      ),
    [factory?.skills],
  );

  async function handleInstallSkills(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedRepoUrl = repoUrl.trim();

    if (!trimmedRepoUrl) {
      setSkillError("Enter a skills repo URL.");
      return;
    }

    setSkillError(null);
    setSkillNotice(null);
    setIsInstalling(true);

    try {
      const response = await authFetch(`/api/factories/${factoryId}/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: trimmedRepoUrl }),
      });
      const body = (await response.json().catch(() => null)) as {
        installed?: unknown[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Skills could not be installed.");
      }

      const count = body?.installed?.length ?? 0;
      setRepoUrl("");
      setSkillNotice(`${count} skill${count === 1 ? "" : "s"} installed.`);
    } catch (error) {
      console.error(error);
      setSkillError(error instanceof Error ? error.message : "Skills could not be installed.");
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleToggleSkill(skillId: string, enabled: boolean) {
    setOptimisticEnabledById((current) => ({ ...current, [skillId]: enabled }));
    setActionSkillId(skillId);
    setSkillError(null);
    setSkillNotice(null);

    try {
      const response = await authFetch(`/api/factories/${factoryId}/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Skill could not be updated.");
      }

      setOptimisticEnabledById((current) => removeOptimisticValue(current, skillId));
    } catch (error) {
      console.error(error);
      setOptimisticEnabledById((current) => removeOptimisticValue(current, skillId));
      setSkillError(error instanceof Error ? error.message : "Skill could not be updated.");
    } finally {
      setActionSkillId(null);
    }
  }

  async function handleDeleteSkill(skillId: string) {
    setActionSkillId(skillId);
    setSkillError(null);
    setSkillNotice(null);

    try {
      const response = await authFetch(`/api/factories/${factoryId}/skills/${skillId}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Skill could not be deleted.");
      }
    } catch (error) {
      console.error(error);
      setSkillError(error instanceof Error ? error.message : "Skill could not be deleted.");
    } finally {
      setActionSkillId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-grayscale-11">
        Loading skills...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-base font-semibold text-grayscale-12">Skills could not be loaded</h1>
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
            <h1 className="font-medium text-grayscale-12">Skills</h1>
            <p className="text-sm text-grayscale-11">
              Install skills that new runs should receive by default.
            </p>
          </div>
        </header>

        <div className="bg-grayscale-2 border border-grayscale-3 rounded-[16px] p-1.5">
          <div className="bg-grayscale-1 w-full rounded-[13px] small-shadow border border-grayscale-3">
            <form onSubmit={handleInstallSkills}>
              <div className="flex flex-col p-3">
                <h2 className="font-medium text-sm text-grayscale-11">Install a skill</h2>
                <p className="text-xs text-grayscale-11">Install a skill to your factory.</p>
              </div>
              <Input
                disabled={isInstalling}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/org/skills"
                value={repoUrl}
              />
              <div className="flex flex-row p-2 justify-end">
                <Button variant="primary" type="submit" disabled={isInstalling}>
                  {isInstalling ? "Installing..." : "Install"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {skillError ? (
          <div className="mx-1.5 mt-3 rounded-lg border border-red-6 bg-red-3 px-3 py-2 text-sm text-red-11">
            {skillError}
          </div>
        ) : null}

        {skillNotice ? (
          <div className="mx-1.5 mt-3 rounded-lg border border-grayscale-5 bg-grayscale-3 px-3 py-2 text-sm text-grayscale-11">
            {skillNotice}
          </div>
        ) : null}

        <div className="flex flex-col px-4.5 py-4">
          <h1 className="font-medium text-grayscale-12">Installed Skills</h1>
          <p className="text-sm text-grayscale-11">Skills that are installed on your factory.</p>
        </div>
        <div className="bg-grayscale-2 border border-grayscale-3 rounded-[16px] p-1.5">
          <div className="bg-grayscale-1 w-full rounded-[13px] small-shadow border border-grayscale-3">
            {skills.length === 0 ? (
              <div className="p-6 text-center text-sm text-grayscale-10">
                No skills installed yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-grayscale-3">
                {skills.map((skill) => {
                  const enabled = optimisticEnabledById[skill.id] ?? skill.status === "installed";
                  const isBusy = actionSkillId === skill.id;

                  return (
                    <div
                      key={skill.id}
                      className="flex flex-row items-start justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          {skill.status === "failed" ? (
                            <WarningCircleIcon
                              size={14}
                              weight="fill"
                              className="text-red-10"
                              aria-hidden="true"
                            />
                          ) : null}
                          <h2 className="truncate font-medium text-sm text-grayscale-11">
                            {skill.name}
                          </h2>
                        </div>
                        <p className="truncate text-xs text-grayscale-11">
                          {skill.skillPath ?? skill.repoUrl}
                        </p>
                        {skill.lastError ? (
                          <p className="mt-2 text-xs text-red-11">{skill.lastError}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Switch
                          aria-label={`${enabled ? "Disable" : "Enable"} ${skill.name}`}
                          checked={enabled}
                          disabled={isBusy}
                          onCheckedChange={(nextChecked) =>
                            void handleToggleSkill(skill.id, nextChecked)
                          }
                        />
                        <Button
                          variant="secondary"
                          disabled={isBusy}
                          onClick={() => void handleDeleteSkill(skill.id)}
                        >
                          <TrashIcon size={14} weight="bold" aria-hidden="true" />
                        </Button>
                      </div>
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
