import { db } from "@/app/lib/admin-db";
import {
  installSkills,
  removeInstalledSkills,
  type SkillRecord,
  withFactorySnapshotBox,
} from "@/app/lib/factory-skills";
import { errorResponse, requireFactoryMember } from "@/app/lib/server-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ factoryId: string; skillId: string }>;
};

type FactoryRecord = {
  id: string;
  name: string;
  snapshotId?: string | null;
  skills?: SkillRecord[];
};

type UpdateSkillRequest = {
  enabled?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { factoryId, skillId } = await context.params;
  let body: UpdateSkillRequest;

  try {
    await requireFactoryMember(request, factoryId);
  } catch (error) {
    return errorResponse(error, "Skill could not be updated.");
  }

  try {
    body = (await request.json()) as UpdateSkillRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled is required" }, { status: 400 });
  }

  try {
    const { factory, skill } = await getFactorySkill(factoryId, skillId);

    if (!factory || !skill) {
      return Response.json({ error: "Skill not found" }, { status: 404 });
    }

    if (!factory.snapshotId) {
      return Response.json(
        { error: "Factory setup must finish before skills can be changed." },
        { status: 409 },
      );
    }

    const { snapshotId } = await withFactorySnapshotBox({
      factoryName: factory.name,
      snapshotId: factory.snapshotId,
      work: async (boxId) => {
        if (body.enabled) {
          if (!skill.skillPath) {
            throw new Error("Skill cannot be enabled because it has no path.");
          }

          await installSkills({
            boxId,
            repoUrl: skill.repoUrl,
            skillPaths: [skill.skillPath],
          });
        } else {
          await removeInstalledSkills(boxId, [skill]);
        }
      },
    });

    await db.transact([
      db.tx.factories[factoryId].update({ snapshotId }),
      db.tx.skills[skillId].update({
        lastError: "",
        status: body.enabled ? "installed" : "disabled",
      }),
    ]);

    return Response.json({
      id: skillId,
      status: body.enabled ? "installed" : "disabled",
    });
  } catch (error) {
    console.error(error);

    return errorResponse(error, "Skill could not be updated.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { factoryId, skillId } = await context.params;

  try {
    await requireFactoryMember(request, factoryId);
    const { factory, skill } = await getFactorySkill(factoryId, skillId);

    if (!factory || !skill) {
      return Response.json({ error: "Skill not found" }, { status: 404 });
    }

    if (!factory.snapshotId) {
      await db.transact(db.tx.skills[skillId].delete());
      return Response.json({ id: skillId, deleted: true });
    }

    const { snapshotId } = await withFactorySnapshotBox({
      factoryName: factory.name,
      snapshotId: factory.snapshotId,
      work: async (boxId) => {
        await removeInstalledSkills(boxId, [skill]);
      },
    });

    await db.transact([
      db.tx.factories[factoryId].update({ snapshotId }),
      db.tx.skills[skillId].delete(),
    ]);

    return Response.json({ id: skillId, deleted: true });
  } catch (error) {
    console.error(error);

    return errorResponse(error, "Skill could not be deleted.");
  }
}

async function getFactorySkill(factoryId: string, skillId: string) {
  const result = await db.query({
    factories: {
      $: { where: { id: factoryId } },
      skills: {},
    },
  });
  const factory = result.factories[0] as FactoryRecord | undefined;
  const skill = factory?.skills?.find((item) => item.id === skillId);

  return { factory, skill };
}
