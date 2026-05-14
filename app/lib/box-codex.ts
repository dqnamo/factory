import { Box } from "@upstash/box";

export type BoxCodexLoginResult =
  | { status: "authenticated"; boxId: string }
  | { status: "pending"; boxId: string; code: string; verificationUrl: string };

export type BoxCodexStatus = "authenticated" | "pending" | "idle" | "failed" | "stale";

const defaultVerificationUrl = "https://auth.openai.com/codex/device";
export const boxWorkspace = "/workspace/home";
export const factoryRepoDir = `${boxWorkspace}/repo`;
const factoryDir = `${boxWorkspace}/.factory`;
const loginLogPath = `${factoryDir}/codex-login.log`;
const loginPidPath = `${factoryDir}/codex-login.pid`;
const loginExitCodePath = `${factoryDir}/codex-login.exit`;
const codexReadinessCommand =
  "(command -v codex >/dev/null 2>&1 || npm install -g @openai/codex) && codex --version";

const startCodexLoginCommand = [
  `mkdir -p ${factoryDir}`,
  `rm -f ${loginLogPath} ${loginPidPath} ${loginExitCodePath}`,
  `{ sh -lc 'codex login --device-auth > ${loginLogPath} 2>&1; echo $? > ${loginExitCodePath}' & echo $! > ${loginPidPath}; }`,
  `for i in $(seq 1 20); do if test -s ${loginLogPath} || test -s ${loginExitCodePath}; then break; fi; sleep 1; done`,
  `{ cat ${loginLogPath} 2>/dev/null || true; }`,
  `if test -s ${loginExitCodePath} && test "$(cat ${loginExitCodePath})" != "0"; then exit "$(cat ${loginExitCodePath})"; fi`,
].join(" && ");

const codexStatusCommand = "codex login status 2>&1 || true";

const codexLoginLogCommand = [
  `if test -s ${loginExitCodePath}; then code="$(cat ${loginExitCodePath})"; if test "$code" = "0"; then echo __FACTORY_CODEX_LOGIN_AUTHENTICATED__; else echo __FACTORY_CODEX_LOGIN_FAILED__=$code; fi; elif test -f ${loginPidPath}; then pid="$(cat ${loginPidPath})"; if kill -0 "$pid" 2>/dev/null; then echo __FACTORY_CODEX_LOGIN_PENDING__; else echo __FACTORY_CODEX_LOGIN_STALE__; fi; fi`,
  `cat ${loginLogPath} 2>/dev/null || true`,
].join("; ");

export async function createBoxForFactory() {
  const apiKey = getBoxApiKey();
  const box = await Box.create({
    apiKey,
    runtime: "node",
  });

  const result = await runBoxCommand(box.id, {
    command: codexReadinessCommand,
    cwd: boxWorkspace,
    timeout_ms: 30_000,
  });

  if (!result.success) {
    throw new Error(
      `Could not prepare Codex box: ${cleanOutput(getOutput(result)) || "No output from readiness check."}`,
    );
  }

  return box.id;
}

export async function startBoxCodexLogin(
  boxId: string | null | undefined,
): Promise<BoxCodexLoginResult> {
  const activeBoxId = boxId ?? (await createBoxForFactory());
  const status = await getBoxCodexStatus(activeBoxId);

  if (status === "authenticated") {
    return { status: "authenticated", boxId: activeBoxId };
  }

  const result = await runBoxCommand(activeBoxId, {
    command: startCodexLoginCommand,
    cwd: boxWorkspace,
    timeout_ms: 25_000,
  });
  const output = getOutput(result);
  const loginDetails = parseDeviceLoginDetails(output);

  if (!loginDetails) {
    const nextStatus = await getBoxCodexStatus(activeBoxId);
    if (nextStatus === "authenticated") {
      return { status: "authenticated", boxId: activeBoxId };
    }
    throw new Error(
      `Could not start Codex device login: ${cleanOutput(output) || "No output from Codex login."}`,
    );
  }

  return {
    status: "pending",
    boxId: activeBoxId,
    code: loginDetails.code,
    verificationUrl: loginDetails.verificationUrl,
  };
}

export async function getBoxCodexStatus(boxId: string): Promise<BoxCodexStatus> {
  const statusResult = await runBoxCommand(boxId, {
    command: codexStatusCommand,
    cwd: boxWorkspace,
    timeout_ms: 15_000,
  });
  const statusOutput = getOutput(statusResult);

  if (isStatusAuthenticated(statusOutput)) {
    return "authenticated";
  }

  const loginResult = await runBoxCommand(boxId, {
    command: codexLoginLogCommand,
    cwd: boxWorkspace,
    timeout_ms: 5_000,
  });
  const loginOutput = getOutput(loginResult);

  if (loginOutput.includes("__FACTORY_CODEX_LOGIN_AUTHENTICATED__")) {
    return "authenticated";
  }
  if (loginOutput.includes("__FACTORY_CODEX_LOGIN_FAILED__")) {
    return "failed";
  }
  if (loginOutput.includes("__FACTORY_CODEX_LOGIN_STALE__")) {
    return "stale";
  }
  if (isLoginLogAuthenticated(loginOutput)) {
    return "authenticated";
  }
  if (loginOutput.includes("__FACTORY_CODEX_LOGIN_PENDING__")) {
    return "pending";
  }

  return "idle";
}

interface BoxCommandResult {
  command: string;
  exitCode: number;
  stderr: string;
  stdout: string;
  success: boolean;
}

export async function runBoxCommand(
  boxId: string,
  input: { command: string; cwd?: string; timeout_ms?: number },
) {
  const apiKey = getBoxApiKey();
  const box = await Box.get(boxId, { apiKey });

  const timeoutSeconds = input.timeout_ms ? Math.max(1, Math.ceil(input.timeout_ms / 1_000)) : null;
  const timeoutPrefix = timeoutSeconds ? `timeout ${timeoutSeconds}s ` : "";
  const fullCommand = [
    `cd ${shellQuote(input.cwd ?? boxWorkspace)}`,
    `${timeoutPrefix}sh -lc ${shellQuote(input.command)}`,
  ].join(" && ");

  const run = await box.exec.command(fullCommand);
  const output = String(run.result ?? "");
  const exitCode = run.exitCode ?? (run.status === "completed" ? 0 : 1);
  const success = run.status === "completed" && exitCode === 0;

  return {
    command: input.command,
    exitCode,
    stderr: success ? "" : output,
    stdout: success ? output : "",
    success,
  } satisfies BoxCommandResult;
}

function getBoxApiKey() {
  const key = process.env.UPSTASH_BOX_API_KEY;
  if (!key) {
    throw new Error("UPSTASH_BOX_API_KEY is required");
  }
  return key;
}

export function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function parseDeviceLoginDetails(output: string) {
  const clean = cleanOutput(output);
  const verificationUrl =
    clean.match(/https:\/\/auth\.openai\.com\/[^\s)"']+/)?.[0] ?? defaultVerificationUrl;
  const code = clean
    .match(/\b[A-Z0-9]{4,}(?:[-\u2010-\u2015][A-Z0-9]{4,})+\b/)?.[0]
    ?.replace(/[\u2010-\u2015]/g, "-");

  if (!code) return null;
  return { code, verificationUrl };
}

function isStatusAuthenticated(output: string) {
  const clean = cleanOutput(output).toLowerCase();
  if (
    clean.includes("not logged in") ||
    clean.includes("not authenticated") ||
    clean.includes("not signed in")
  ) {
    return false;
  }
  return (
    clean.includes("logged in") ||
    clean.includes("login status") ||
    clean.includes("authenticated") ||
    clean.includes("signed in") ||
    clean.includes("chatgpt")
  );
}

function isLoginLogAuthenticated(output: string) {
  const clean = cleanOutput(output).toLowerCase();
  return (
    clean.includes("logged in") ||
    clean.includes("authenticated") ||
    clean.includes("signed in") ||
    clean.includes("successfully")
  );
}

export function getOutput(result: BoxCommandResult) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes
const ansiEscapeRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function cleanOutput(output: string) {
  return output
    .replace(ansiEscapeRegex, "")
    .replace(/^data:\s?/gm, "")
    .replace(/^event:\s?.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function snapshotBox(boxId: string, name: string) {
  const apiKey = getBoxApiKey();
  const box = await Box.get(boxId, { apiKey });
  const snapshot = await box.snapshot({ name });
  return snapshot;
}

export async function deleteBox(boxId: string) {
  const apiKey = getBoxApiKey();
  const box = await Box.get(boxId, { apiKey });
  await box.delete();
}

export async function restoreBoxFromSnapshot(
  snapshotId: string,
  opts?: { env?: Record<string, string> },
) {
  const apiKey = getBoxApiKey();
  const box = await Box.fromSnapshot(snapshotId, { apiKey, env: opts?.env });
  return box.id;
}

export async function configureGitInBox(
  boxId: string,
  githubToken: string,
  identity?: { name?: string | null; email?: string | null },
) {
  const githubUser = await fetchGithubUser(githubToken);
  const name = identity?.name?.trim() || githubUser.name;
  const email = identity?.email?.trim() || githubUser.email;
  const authHeader = getGithubAuthHeader(githubToken);

  const tokenUrl = `https://x-access-token:${githubToken}@github.com/`;
  const command = [
    "command -v git >/dev/null 2>&1 || { apt-get update && apt-get install -y git; }",
    `git config --global url.${shellQuote(tokenUrl)}.insteadOf ${shellQuote("https://github.com/")}`,
    `git config --global http.https://github.com/.extraheader ${shellQuote(authHeader)}`,
    `git config --global user.name ${shellQuote(name)}`,
    `git config --global user.email ${shellQuote(email)}`,
    `if test -d ${shellQuote(`${factoryRepoDir}/.git`)}; then git -C ${shellQuote(factoryRepoDir)} config url.${shellQuote(tokenUrl)}.insteadOf ${shellQuote("https://github.com/")} && git -C ${shellQuote(factoryRepoDir)} config http.https://github.com/.extraheader ${shellQuote(authHeader)} && git -C ${shellQuote(factoryRepoDir)} config user.name ${shellQuote(name)} && git -C ${shellQuote(factoryRepoDir)} config user.email ${shellQuote(email)}; fi`,
    `if command -v gh >/dev/null 2>&1; then printf %s ${shellQuote(githubToken)} | gh auth login --hostname github.com --with-token >/dev/null 2>&1 || true; gh auth setup-git --hostname github.com >/dev/null 2>&1 || true; fi`,
  ].join(" && ");

  const result = await runBoxCommand(boxId, {
    command,
    cwd: boxWorkspace,
    timeout_ms: 15_000,
  });

  if (!result.success) {
    throw new Error(`Could not configure git: ${cleanOutput(getOutput(result)) || "No output."}`);
  }
}

async function fetchGithubUser(token: string): Promise<{ name: string; email: string }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const user = (await res.json()) as {
      name?: string;
      login?: string;
      email?: string;
      id?: number;
    };
    const name = user.name || user.login || "Factory";
    const email =
      user.email ||
      (user.id
        ? `${user.id}+${user.login}@users.noreply.github.com`
        : "factory@noreply.github.com");
    return { name, email };
  } catch {
    return { name: "Factory", email: "factory@noreply.github.com" };
  }
}

export async function syncGithubRepo(
  boxId: string,
  input: { repoUrl: string; githubToken: string },
) {
  const repoUrl = normalizeGithubRepoUrl(input.repoUrl);
  const authHeader = getGithubAuthHeader(input.githubToken);
  const resetGitAuthConfig = shellQuote("http.https://github.com/.extraheader=");
  const gitAuthConfig = shellQuote(`http.https://github.com/.extraheader=${authHeader}`);
  const gitAuthArgs = `-c ${resetGitAuthConfig} -c ${gitAuthConfig}`;

  const command = [
    "command -v git >/dev/null 2>&1 || { apt-get update && apt-get install -y git; }",
    `if test -d ${shellQuote(`${factoryRepoDir}/.git`)}; then ` +
      [
        `current_remote="$(git -C ${shellQuote(factoryRepoDir)} remote get-url origin 2>/dev/null || true)"; if test "$current_remote" != ${shellQuote(repoUrl)}; then cd ${shellQuote(boxWorkspace)} && rm -rf ${shellQuote(factoryRepoDir)} && git ${gitAuthArgs} clone --quiet ${shellQuote(repoUrl)} ${shellQuote(factoryRepoDir)} && git -C ${shellQuote(factoryRepoDir)} remote set-url origin ${shellQuote(repoUrl)}; exit 0; fi`,
        `git -C ${shellQuote(factoryRepoDir)} ${gitAuthArgs} fetch --quiet origin`,
        `branch="$(git -C ${shellQuote(factoryRepoDir)} symbolic-ref --quiet --short refs/remotes/origin/HEAD | sed 's#^origin/##')"; if test -z "$branch"; then branch="$(git -C ${shellQuote(factoryRepoDir)} rev-parse --abbrev-ref HEAD)"; fi; git -C ${shellQuote(factoryRepoDir)} checkout --quiet "$branch"; git -C ${shellQuote(factoryRepoDir)} ${gitAuthArgs} pull --ff-only --quiet origin "$branch"`,
      ].join(" && ") +
      `; else rm -rf ${shellQuote(factoryRepoDir)} && git ${gitAuthArgs} clone --quiet ${shellQuote(repoUrl)} ${shellQuote(factoryRepoDir)} && git -C ${shellQuote(factoryRepoDir)} remote set-url origin ${shellQuote(repoUrl)}; fi`,
  ].join(" && ");

  const result = await runBoxCommand(boxId, {
    command,
    cwd: boxWorkspace,
    timeout_ms: 120_000,
  });

  if (!result.success) {
    throw new Error(
      `Could not sync GitHub repository: ${cleanOutput(getOutput(result)) || "No output from git."}`,
    );
  }
}

export async function killRunningCodexExec(boxId: string) {
  try {
    await runBoxCommand(boxId, {
      command: "pkill -f 'codex exec' 2>/dev/null || true",
      cwd: boxWorkspace,
      timeout_ms: 5_000,
    });
  } catch {
    // Best-effort kill
  }
}

export async function streamCodexExec(
  boxId: string,
  opts: { prompt: string; resume: boolean; cwd?: string; env?: Record<string, string> },
  onEvent: (event: Record<string, unknown>) => Promise<void>,
) {
  const apiKey = getBoxApiKey();
  const box = await Box.get(boxId, { apiKey });

  const escapedPrompt = shellQuote(opts.prompt);

  const codexCommand = opts.resume
    ? `codex exec resume --last ${escapedPrompt} --json --dangerously-bypass-approvals-and-sandbox`
    : `codex exec ${escapedPrompt} --json --dangerously-bypass-approvals-and-sandbox`;

  const envExports = Object.entries(opts.env ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `export ${k}=${shellQuote(v)}`)
    .join(" && ");

  const cwd = opts.cwd ?? boxWorkspace;
  const fullCommand = [
    `cd ${shellQuote(cwd)}`,
    envExports || null,
    `sh -lc ${shellQuote(codexCommand)}`,
  ]
    .filter(Boolean)
    .join(" && ");

  const stream = await box.exec.stream(fullCommand);
  let buffer = "";

  for await (const chunk of stream) {
    if (chunk.type === "output") {
      buffer += chunk.data;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          await onEvent(JSON.parse(trimmed));
        } catch {
          // Not valid JSON, skip
        }
      }
    }
  }

  if (buffer.trim()) {
    try {
      await onEvent(JSON.parse(buffer.trim()));
    } catch {
      // Not valid JSON, skip
    }
  }
}

function normalizeGithubRepoUrl(repoUrl: string) {
  const trimmed = repoUrl.trim();
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}.git`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("GitHub repository URL must be a valid URL.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error("GitHub repository URL must be an https://github.com URL.");
  }

  const path = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!/^[^/]+\/[^/]+(?:\.git)?$/.test(path)) {
    throw new Error("GitHub repository URL must include an owner and repository name.");
  }

  return `https://github.com/${path.endsWith(".git") ? path : `${path}.git`}`;
}

function getGithubAuthHeader(githubToken: string) {
  const token = githubToken.trim();
  if (!token) {
    throw new Error("GitHub token is required.");
  }
  return `AUTHORIZATION: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
}
