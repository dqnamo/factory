import {
  cleanOutput,
  deleteBox,
  getOutput,
  restoreBoxFromSnapshot,
  runBoxCommand,
  shellQuote,
  snapshotBox,
} from "@/app/lib/box-codex";

export type SkillCandidate = {
  description: string;
  name: string;
  path: string;
};

export type SkillRecord = {
  id: string;
  name: string;
  repoUrl: string;
  skillPath?: string | null;
  status: string;
};

export async function withFactorySnapshotBox<T>({
  factoryName,
  snapshotId,
  work,
}: {
  factoryName: string;
  snapshotId: string;
  work: (boxId: string) => Promise<T>;
}) {
  const boxId = await restoreBoxFromSnapshot(snapshotId);

  try {
    const result = await work(boxId);
    const snapshot = await snapshotBox(
      boxId,
      `${sanitizeSnapshotName(factoryName)}-skills-${Date.now()}`,
    );

    return { result, snapshotId: snapshot.id };
  } finally {
    await deleteBox(boxId).catch(() => {});
  }
}

export async function listSkillCandidates(boxId: string, repoUrl: string) {
  const sourceDir = `/tmp/factory-skills-${Date.now()}`;
  const jsonMarker = "__FACTORY_SKILLS_JSON__";
  const scanner = `
const fs = require("fs");
const path = require("path");
const root = process.env.FACTORY_SKILL_SOURCE_DIR;
const marker = process.env.FACTORY_SKILL_JSON_MARKER;

function stripQuotes(value) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function readField(content, field) {
  const lines = content.split(/\\r?\\n/);

  for (const line of lines) {
    const match = line.match(new RegExp("^" + field + "\\\\s*:\\\\s*(.*)$"));

    if (match) {
      return stripQuotes(match[1] || "");
    }
  }

  return "";
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const nextPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(nextPath, files);
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(nextPath);
    }
  }
}

const files = [];
walk(root, files);
const candidates = files.sort().map((file) => {
  const content = fs.readFileSync(file, "utf8");
  const relativePath = path.relative(root, file).split(path.sep).join("/");

  return {
    description: readField(content, "description"),
    name: readField(content, "name") || path.basename(path.dirname(file)),
    path: relativePath,
  };
});

process.stdout.write(marker + JSON.stringify(candidates));
`;
  const result = await runBoxCommand(boxId, {
    command: [
      `rm -rf ${shellQuote(sourceDir)}`,
      `git clone --quiet --depth 1 ${shellQuote(repoUrl)} ${shellQuote(sourceDir)}`,
      `FACTORY_SKILL_SOURCE_DIR=${shellQuote(sourceDir)} FACTORY_SKILL_JSON_MARKER=${shellQuote(jsonMarker)} node -e ${shellQuote(scanner)}`,
    ].join(" && "),
    timeout_ms: 120_000,
  });

  if (!result.success) {
    throw new Error(cleanOutput(getOutput(result)) || "Skill repo could not be listed.");
  }

  const output = cleanOutput(getOutput(result));
  const markerIndex = output.lastIndexOf(jsonMarker);
  const jsonOutput =
    markerIndex >= 0 ? output.slice(markerIndex + jsonMarker.length).trim() : output;

  try {
    const parsed = JSON.parse(jsonOutput) as SkillCandidate[];

    return parsed.filter(
      (candidate): candidate is SkillCandidate =>
        typeof candidate?.path === "string" &&
        candidate.path.endsWith("SKILL.md") &&
        typeof candidate.name === "string" &&
        typeof candidate.description === "string",
    );
  } catch {
    throw new Error(output || "Skill repo returned an unreadable skill list.");
  }
}

export async function installSkills({
  boxId,
  repoUrl,
  skillPaths,
}: {
  boxId: string;
  repoUrl: string;
  skillPaths: string[];
}) {
  const sourceDir = `/tmp/factory-skills-install-${Date.now()}`;
  const installCommands = skillPaths.map((skillPath) => {
    assertSafeSkillPath(skillPath);

    const sourceSkill = `${sourceDir}/${skillPath}`;
    const sourceSkillDir = sourceSkill.replace(/\/SKILL\.md$/, "");
    const fallbackName = getFallbackSkillName(skillPath);

    return [
      `test -f ${shellQuote(sourceSkill)}`,
      `skill_name="$(sed -n 's/^name:[[:space:]]*//p' ${shellQuote(sourceSkill)} | head -n 1 | sed 's/^["'\\''"]//; s/["'\\''"]$//; s/[^a-zA-Z0-9._-]/-/g')"`,
      `if test -z "$skill_name"; then skill_name=${shellQuote(fallbackName)}; fi`,
      `target="$HOME/.agents/skills/$skill_name"`,
      `rm -rf "$target"`,
      `mkdir -p "$HOME/.agents/skills"`,
      `cp -R ${shellQuote(sourceSkillDir)} "$target"`,
    ].join(" && ");
  });

  const result = await runBoxCommand(boxId, {
    command: [
      `rm -rf ${shellQuote(sourceDir)}`,
      `git clone --quiet --depth 1 ${shellQuote(repoUrl)} ${shellQuote(sourceDir)}`,
      ...installCommands,
    ].join(" && "),
    timeout_ms: 180_000,
  });

  if (!result.success) {
    throw new Error(cleanOutput(getOutput(result)) || "Skills could not be installed.");
  }
}

export async function removeInstalledSkills(boxId: string, skills: SkillRecord[]) {
  const targets = skills.map((skill) =>
    skill.name
      ? sanitizeSkillDirectoryName(skill.name)
      : getFallbackSkillName(skill.skillPath ?? ""),
  );

  const result = await runBoxCommand(boxId, {
    command: [
      `mkdir -p "$HOME/.agents/skills"`,
      ...targets.map((target) => `rm -rf "$HOME/.agents/skills/${target}"`),
    ].join(" && "),
    timeout_ms: 30_000,
  });

  if (!result.success) {
    throw new Error(cleanOutput(getOutput(result)) || "Skills could not be removed.");
  }
}

function assertSafeSkillPath(skillPath: string) {
  if (!skillPath || skillPath.startsWith("/") || skillPath.includes("..")) {
    throw new Error(`Invalid skill path: ${skillPath}`);
  }
}

function getFallbackSkillName(skillPath: string) {
  return (
    skillPath
      .split("/")
      .filter(Boolean)
      .slice(-2, -1)[0]
      ?.replace(/[^a-zA-Z0-9._-]/g, "-") || "factory-skill"
  );
}

function sanitizeSkillDirectoryName(name: string) {
  return name
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sanitizeSnapshotName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-") || "factory";
}
