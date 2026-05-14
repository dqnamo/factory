import { Box } from "@upstash/box";

export const boxWorkspace = "/workspace/home";
const factoryDir = `${boxWorkspace}/.factory`;
const execPidPath = `${factoryDir}/cursor-exec.pid`;
const execOutputPath = `${factoryDir}/cursor-exec.out`;
const execExitCodePath = `${factoryDir}/cursor-exec.exit`;
const POLL_INTERVAL_MS = 1_500;

const cursorReadinessCommand =
  "(command -v agent >/dev/null 2>&1 || { curl https://cursor.com/install -fsS | bash; }) && agent --version";

export async function ensureCursorCli(boxId: string) {
  const result = await runBoxCommand(boxId, {
    command: cursorReadinessCommand,
    cwd: boxWorkspace,
    timeout_ms: 60_000,
  });

  if (!result.success) {
    throw new Error(
      `Could not install Cursor CLI: ${cleanOutput(getOutput(result)) || "No output from readiness check."}`,
    );
  }

  return result.stdout.trim();
}

export async function createBoxForCursorFactory(cursorApiKey: string) {
  const apiKey = getBoxApiKey();
  const box = await Box.create({ apiKey, runtime: "node" });

  await runBoxCommand(box.id, {
    command: cursorReadinessCommand,
    cwd: boxWorkspace,
    timeout_ms: 60_000,
  });

  await runBoxCommand(box.id, {
    command: `mkdir -p ${factoryDir} && echo ${shellQuote(cursorApiKey)} > ${factoryDir}/.cursor-api-key`,
    cwd: boxWorkspace,
    timeout_ms: 5_000,
  });

  return box.id;
}

export async function validateCursorApiKey(cursorApiKey: string): Promise<boolean> {
  if (!cursorApiKey?.startsWith("cursor_")) {
    return false;
  }
  return cursorApiKey.length > 10;
}

export async function killRunningCursorExec(boxId: string) {
  try {
    await runBoxCommand(boxId, {
      command: `if test -f ${execPidPath}; then pid="$(cat ${execPidPath})"; kill "$pid" 2>/dev/null || true; rm -f ${execPidPath}; fi`,
      cwd: boxWorkspace,
      timeout_ms: 5_000,
    });
  } catch {
    // Best-effort kill
  }
}

export async function streamCursorExec(
  boxId: string,
  opts: { prompt: string; cursorApiKey: string; cwd?: string },
  onEvent: (event: Record<string, unknown>) => Promise<void>,
) {
  const escapedPrompt = shellQuote(opts.prompt);

  const cursorCommand = `CURSOR_API_KEY=${shellQuote(opts.cursorApiKey)} agent -p --force --output-format stream-json ${escapedPrompt}`;

  const launchCommand = [
    `mkdir -p ${factoryDir}`,
    `rm -f ${execOutputPath} ${execExitCodePath} ${execPidPath}`,
    `touch ${execOutputPath}`,
    `{ sh -lc '${cursorCommand.replace(/'/g, "'\\''")} >> ${execOutputPath} 2>&1; echo $? > ${execExitCodePath}' & echo $! > ${execPidPath}; }`,
  ].join(" && ");

  const launchResult = await runBoxCommand(boxId, {
    command: launchCommand,
    cwd: opts.cwd ?? boxWorkspace,
    timeout_ms: 15_000,
  });
  if (!launchResult.success) {
    throw new Error(
      `Could not start Cursor exec: ${cleanOutput(getOutput(launchResult)) || "No output from launch command."}`,
    );
  }

  let linesRead = 0;

  while (true) {
    const checkResult = await runBoxCommand(boxId, {
      command: [
        `tail -n +${linesRead + 1} ${execOutputPath} 2>/dev/null || true`,
        `echo "---FACTORY_SEPARATOR---"`,
        `test -f ${execExitCodePath} && echo "DONE:$(cat ${execExitCodePath})" || echo "RUNNING"`,
      ].join("; "),
      cwd: opts.cwd ?? boxWorkspace,
      timeout_ms: 10_000,
    });

    const output = getOutput(checkResult);
    const separatorIdx = output.lastIndexOf("---FACTORY_SEPARATOR---");
    const newContent = separatorIdx >= 0 ? output.slice(0, separatorIdx) : "";
    const statusLine =
      separatorIdx >= 0 ? output.slice(separatorIdx + "---FACTORY_SEPARATOR---".length).trim() : "";

    if (newContent.trim()) {
      const lines = newContent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        linesRead++;
        try {
          const parsed = JSON.parse(trimmed);
          const mapped = mapCursorEventToFactoryEvent(parsed);
          await onEvent(mapped);
        } catch {
          // Not valid JSON, skip
        }
      }
    }

    if (statusLine.startsWith("DONE:")) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  try {
    await runBoxCommand(boxId, {
      command: `rm -f ${execPidPath} ${execExitCodePath}`,
      cwd: opts.cwd ?? boxWorkspace,
      timeout_ms: 3_000,
    });
  } catch {
    // Cleanup is best-effort
  }
}

/**
 * Maps Cursor CLI stream-json events to the factory event format
 * that the run page understands.
 *
 * Cursor emits: system, user, assistant, tool_call, result
 * Factory expects: message, item.completed (agent_message), error, plus raw events
 */
function mapCursorEventToFactoryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const type = event.type as string | undefined;

  if (type === "assistant") {
    const message = event.message as { content?: { type: string; text: string }[] } | undefined;
    const text =
      message?.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("") ?? "";

    if (text) {
      return {
        type: "item.completed",
        item: { type: "agent_message", text },
        _cursor: event,
      };
    }
  }

  if (type === "tool_call") {
    const subtype = event.subtype as string | undefined;
    const toolCall = event.tool_call as Record<string, unknown> | undefined;

    if (subtype === "started") {
      const toolName = toolCall ? Object.keys(toolCall).find((k) => k !== "args") : "unknown";
      return {
        type: "cursor.tool_call.started",
        toolName,
        _cursor: event,
      };
    }

    if (subtype === "completed") {
      return {
        type: "cursor.tool_call.completed",
        _cursor: event,
      };
    }
  }

  if (type === "result") {
    const subtype = event.subtype as string | undefined;
    if (subtype === "success") {
      return {
        type: "cursor.result",
        result: event.result,
        durationMs: event.duration_ms,
        _cursor: event,
      };
    }
  }

  if (type === "system") {
    return {
      type: "cursor.system",
      model: (event as Record<string, unknown>).model,
      _cursor: event,
    };
  }

  return { type: `cursor.${type ?? "unknown"}`, _cursor: event };
}

interface BoxCommandResult {
  command: string;
  exitCode: number;
  stderr: string;
  stdout: string;
  success: boolean;
}

async function runBoxCommand(
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

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function getOutput(result: BoxCommandResult) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes
const ansiEscapeRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function cleanOutput(output: string) {
  return output
    .replace(ansiEscapeRegex, "")
    .replace(/^data:\s?/gm, "")
    .replace(/^event:\s?.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
