import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "../app/lib/admin-db";
import { deleteBox, snapshotBox, syncGithubRepo } from "../app/lib/box-codex";
import { ensureCursorCli } from "../app/lib/box-cursor";

export const setupFactoryTask = task({
  id: "setup-factory",
  maxDuration: 600,
  run: async (payload: { factoryId: string }, { ctx }) => {
    logger.log("Setting up factory", { payload, ctx });

    const result = await db.query({
      factories: { $: { where: { id: payload.factoryId } } },
    });

    const factory = result.factories[0];
    if (!factory) {
      throw new Error(`Factory ${payload.factoryId} not found`);
    }

    if (!factory.sandboxId) {
      throw new Error(`Factory ${payload.factoryId} has no base sandbox`);
    }

    if (factory.snapshotId) {
      logger.log("Factory already has a snapshot, skipping", {
        snapshotId: factory.snapshotId,
      });
      return { snapshotId: factory.snapshotId };
    }

    const engine = factory.engine ?? "codex";

    if (engine === "cursor") {
      logger.log("Ensuring Cursor CLI is installed in box", {
        sandboxId: factory.sandboxId,
      });
      const version = await ensureCursorCli(factory.sandboxId);
      logger.log("Cursor CLI ready", { version });
    }

    if (factory.githubRepoUrl) {
      if (!factory.githubToken) {
        throw new Error(`Factory ${payload.factoryId} has no GitHub token`);
      }

      logger.log("Cloning GitHub repository into base box", {
        sandboxId: factory.sandboxId,
        repoUrl: factory.githubRepoUrl,
      });
      await syncGithubRepo(factory.sandboxId, {
        repoUrl: factory.githubRepoUrl,
        githubToken: factory.githubToken,
      });
    }

    logger.log("Taking snapshot of base box", { sandboxId: factory.sandboxId });
    const snapshot = await snapshotBox(factory.sandboxId, factory.name);

    logger.log("Updating factory with snapshotId", { snapshotId: snapshot.id });
    await db.transact(
      db.tx.factories[payload.factoryId].update({
        snapshotId: snapshot.id,
      }),
    );

    logger.log("Deleting base box", { sandboxId: factory.sandboxId });
    await deleteBox(factory.sandboxId);

    await db.transact(
      db.tx.factories[payload.factoryId].update({
        sandboxId: "",
      }),
    );

    logger.log("Factory setup complete", { snapshotId: snapshot.id, engine });
    return { snapshotId: snapshot.id };
  },
});
