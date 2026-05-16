"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import { authFetch } from "@/app/lib/auth-fetch";
import { db } from "@/app/lib/instant";

export default function GithubPage() {
  const params = useParams<{ factoryId: string }>();
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [gitName, setGitName] = useState<string | null>(null);
  const [gitEmail, setGitEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = db.useQuery(
    params.factoryId
      ? {
          factories: {
            $: { where: { id: params.factoryId } },
          },
        }
      : null,
  );

  const factory = data?.factories[0];
  const hasSavedToken = Boolean(factory?.githubTokenSet);
  const displayedRepoUrl = repoUrl ?? factory?.githubRepoUrl ?? "";
  const displayedGitName = gitName ?? factory?.gitName ?? "";
  const displayedGitEmail = gitEmail ?? factory?.gitEmail ?? "";

  const handleSave = useCallback(async () => {
    const trimmedRepoUrl = displayedRepoUrl.trim();
    const trimmedToken = token.trim();
    const trimmedGitName = displayedGitName.trim();
    const trimmedGitEmail = displayedGitEmail.trim();

    if (!trimmedRepoUrl) {
      setError("Enter a repository URL.");
      return;
    }

    if (!hasSavedToken && !trimmedToken) {
      setError("Enter a GitHub token.");
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const update: {
        gitEmail: string;
        gitName: string;
        githubRepoUrl: string;
        githubToken?: string;
      } = {
        gitEmail: trimmedGitEmail,
        gitName: trimmedGitName,
        githubRepoUrl: trimmedRepoUrl,
      };

      if (trimmedToken) {
        update.githubToken = trimmedToken;
      }

      const response = await authFetch(`/api/factories/${params.factoryId}/github`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save GitHub settings.");
      }

      setToken("");
      setRepoUrl(trimmedRepoUrl);
      setGitName(trimmedGitName);
      setGitEmail(trimmedGitEmail);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save GitHub settings.");
    } finally {
      setSaving(false);
    }
  }, [
    displayedRepoUrl,
    token,
    displayedGitName,
    displayedGitEmail,
    hasSavedToken,
    params.factoryId,
  ]);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-5 sm:px-0 sm:py-8 flex flex-col gap-4 overflow-y-auto flex-1">
      <div className="flex flex-col px-4.5">
        <h1 className="font-medium text-grayscale-12">GitHub</h1>
        <p className="text-sm text-grayscale-11">
          Connect the repository this factory should work from.
        </p>
      </div>

      <div className="bg-grayscale-2 border border-grayscale-3 rounded-[16px] p-1.5">
        <div className="bg-grayscale-1 w-full rounded-[13px] small-shadow border border-grayscale-3">
          <div className="flex flex-col p-3">
            <h2 className="font-medium text-sm text-grayscale-11">Repository URL</h2>
            <p className="text-xs text-grayscale-11">
              New run sandboxes pull from this repository before the agent starts.
            </p>
          </div>
          <Input
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            disabled={isLoading || saving}
            inputMode="url"
            name="github-repository-url"
            placeholder="https://github.com/factory-ai/factory"
            value={displayedRepoUrl}
            onChange={(event) => {
              setRepoUrl(event.target.value);
              setSaved(false);
            }}
          />
          <div className="flex flex-col p-3">
            <h2 className="font-medium text-sm text-grayscale-11">Token</h2>
            <p className="text-xs text-grayscale-11">
              {hasSavedToken
                ? "A token is saved. Enter a new token here to replace it."
                : "Generate a personal access token from your GitHub account."}
            </p>
          </div>
          <Input
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            disabled={isLoading || saving}
            name="github-token"
            placeholder={hasSavedToken ? "Saved token" : "github_pat_..."}
            type="password"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setSaved(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />

          <div className="flex flex-col p-3">
            <h2 className="font-medium text-sm text-grayscale-11">Commit identity</h2>
            <p className="text-xs text-grayscale-11">
              Optional. When blank, the runner uses the GitHub token owner when it can.
            </p>
          </div>
          <Input
            autoComplete="name"
            disabled={isLoading || saving}
            name="git-name"
            placeholder="Commit author name"
            value={displayedGitName}
            onChange={(event) => {
              setGitName(event.target.value);
              setSaved(false);
            }}
          />
          <Input
            autoComplete="email"
            disabled={isLoading || saving}
            inputMode="email"
            name="git-email"
            placeholder="author@example.com"
            type="email"
            value={displayedGitEmail}
            onChange={(event) => {
              setGitEmail(event.target.value);
              setSaved(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />

          <div className="flex flex-row items-center gap-2 p-2 justify-between border-t border-grayscale-3">
            <div className="px-1">
              {error && <p className="text-xs text-red-11">{error}</p>}
              {saved && <p className="text-xs text-green-11">GitHub settings saved.</p>}
            </div>
            <Button
              variant="primary"
              disabled={
                isLoading || saving || !displayedRepoUrl.trim() || (!hasSavedToken && !token.trim())
              }
              onClick={handleSave}
            >
              <p>{saving ? "Saving..." : "Save"}</p>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
