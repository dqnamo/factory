import { id } from "@instantdb/admin";
import { tasks } from "@trigger.dev/sdk/v3";
import { db } from "@/app/lib/admin-db";
import { errorResponse, requireInstantUser } from "@/app/lib/server-auth";
import type { setupFactoryTask } from "@/trigger/setup-factory";

export const runtime = "nodejs";

type CreateFactoryRequest = {
  cursorApiKey?: string;
  engine?: string;
  factoryName?: string;
  githubRepoUrl?: string;
  githubToken?: string;
  sandboxId?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireInstantUser(request);
    const body = (await request.json()) as CreateFactoryRequest;
    const factoryName = body.factoryName?.trim();
    const githubRepoUrl = body.githubRepoUrl?.trim();
    const githubToken = body.githubToken?.trim();
    const sandboxId = body.sandboxId?.trim();
    const engine = body.engine === "cursor" ? "cursor" : body.engine === "codex" ? "codex" : null;
    const cursorApiKey = body.cursorApiKey?.trim();

    if (!factoryName || !githubRepoUrl || !githubToken || !sandboxId || !engine) {
      return Response.json(
        { error: "factoryName, githubRepoUrl, githubToken, sandboxId, and engine are required." },
        { status: 400 },
      );
    }

    const factoryId = id();
    const factoryUserId = id();
    const factoryFields: Record<string, unknown> = {
      createdAt: Date.now(),
      engine,
      githubRepoUrl,
      githubToken,
      githubTokenSet: true,
      name: factoryName,
      sandboxId,
    };

    if (engine === "cursor" && cursorApiKey) {
      factoryFields.cursorApiKey = cursorApiKey;
    }

    await db.transact([
      db.tx.factories[factoryId].update(factoryFields),
      db.tx.factoryUsers[factoryUserId]
        .update({
          createdAt: Date.now(),
          role: "owner",
        })
        .link({ factory: factoryId, user: user.id }),
    ]);

    const handle = await tasks.trigger<typeof setupFactoryTask>("setup-factory", { factoryId });

    return Response.json({ factoryId, setupRunId: handle.id });
  } catch (error) {
    return errorResponse(error, "Factory could not be created.");
  }
}
