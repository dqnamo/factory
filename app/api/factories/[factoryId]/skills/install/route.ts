import { id } from "@instantdb/admin";
import { db } from "@/app/lib/admin-db";
import {
  installSkills,
  listSkillCandidates,
  type SkillCandidate,
  withFactorySnapshotBox,
} from "@/app/lib/factory-skills";
import { errorResponse, requireFactoryMember } from "@/app/lib/server-auth";

export const runtime = "nodejs";

type InstallSkillsRequest = {
  repoUrl?: string;
  skills?: SkillCandidate[];
};

type RouteContext = {
  params: Promise<{ factoryId: string }>;
};

type FactoryRecord = {
  id: string;
  name: string;
  snapshotId?: string | null;
  skills?: {
    id: string;
    repoUrl?: string;
    skillPath?: string | null;
  }[];
};

export async function POST(request: Request, context: RouteContext) {
  const { factoryId } = await context.params;
  let body: InstallSkillsRequest;

  try {
    await requireFactoryMember(request, factoryId);
  } catch (error) {
    return errorResponse(error, "Skills could not be installed.");
  }

  try {
    body = (await request.json()) as InstallSkillsRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = body.repoUrl?.trim();

  if (!repoUrl) {
    return Response.json({ error: "repoUrl is required" }, { status: 400 });
  }

  try {
    const factory = await getFactory(factoryId);

    if (!factory) {
      return Response.json({ error: "Factory not found" }, { status: 404 });
    }

    if (!factory.snapshotId) {
      return Response.json(
        { error: "Factory setup must finish before skills can be installed." },
        { status: 409 },
      );
    }

    const { result: skills, snapshotId } = await withFactorySnapshotBox({
      factoryName: factory.name,
      snapshotId: factory.snapshotId,
      work: async (boxId) => {
        const discoveredSkills =
          body.skills && body.skills.length > 0
            ? body.skills
            : await listSkillCandidates(boxId, repoUrl);
        const installableSkills = discoveredSkills.filter(
          (skill) => skill.name?.trim() && skill.path?.trim(),
        );

        if (installableSkills.length === 0) {
          throw new Error("No SKILL.md files were found in that repo.");
        }

        await installSkills({
          boxId,
          repoUrl,
          skillPaths: installableSkills.map((skill) => skill.path),
        });

        return installableSkills;
      },
    });

    const installedAt = new Date().toISOString();
    const existingBySource = new Map(
      (factory.skills ?? [])
        .filter((skill) => skill.repoUrl && skill.skillPath)
        .map((skill) => [`${skill.repoUrl}\n${skill.skillPath}`, skill.id]),
    );
    const skillIds = skills.map(
      (skill) => existingBySource.get(`${repoUrl}\n${skill.path}`) ?? id(),
    );

    await db.transact([
      db.tx.factories[factoryId].update({ snapshotId }),
      ...skills.map((skill, index) =>
        db.tx.skills[skillIds[index]].update({
          installedAt,
          lastError: "",
          name: skill.name.trim(),
          repoUrl,
          skillPath: skill.path,
          status: "installed",
        }),
      ),
      ...skillIds.map((skillId) => db.tx.factories[factoryId].link({ skills: skillId })),
    ]);

    return Response.json({
      installed: skills.map((skill) => ({
        name: skill.name,
        path: skill.path,
      })),
      installedAt,
    });
  } catch (error) {
    console.error(error);

    return errorResponse(error, "Skills could not be installed.");
  }
}

async function getFactory(factoryId: string) {
  const result = await db.query({
    factories: {
      $: { where: { id: factoryId } },
      skills: {},
    },
  });

  return result.factories[0] as FactoryRecord | undefined;
}
