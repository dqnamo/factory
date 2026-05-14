import { id } from "@instantdb/admin";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "../app/lib/admin-db";
import {
  configureGitInBox,
  factoryRepoDir,
  killRunningCodexExec,
  restoreBoxFromSnapshot,
  streamCodexExec,
  syncGithubRepo,
} from "../app/lib/box-codex";
import { killRunningCursorExec, streamCursorExec } from "../app/lib/box-cursor";

export const executeFactoryRunTask = task({
  id: "execute-factory-run",
  maxDuration: 3600,
  run: async (payload: { runId: string; factoryId: string; prompt: string }, { ctx }) => {
    logger.log("Executing factory run", { payload, ctx });

    const result = await db.query({
      factories: { $: { where: { id: payload.factoryId } } },
      runs: { $: { where: { id: payload.runId } } },
    });

    const factory = result.factories[0];
    const run = result.runs[0];

    if (!factory) throw new Error(`Factory ${payload.factoryId} not found`);
    if (!run) throw new Error(`Run ${payload.runId} not found`);
    if (!factory.snapshotId) {
      throw new Error(`Factory ${payload.factoryId} has no snapshot — setup not complete`);
    }

    const engine = factory.engine ?? "codex";

    let boxId = run.sandboxId;
    const isResume = !!boxId;
    const boxEnv: Record<string, string> = {};
    if (factory.githubToken) {
      boxEnv.GITHUB_TOKEN = factory.githubToken;
    }

    try {
      if (!boxId) {
        logger.log("Provisioning new box from snapshot", {
          snapshotId: factory.snapshotId,
          engine,
        });
        boxId = await restoreBoxFromSnapshot(factory.snapshotId, { env: boxEnv });

        if (factory.githubToken) {
          logger.log("Configuring git credentials in box", { boxId });
          await configureGitInBox(boxId, factory.githubToken);
        }

        if (factory.githubRepoUrl) {
          if (!factory.githubToken) {
            throw new Error(`Factory ${payload.factoryId} has no GitHub token`);
          }

          logger.log("Pulling latest GitHub repository changes", {
            boxId,
            repoUrl: factory.githubRepoUrl,
          });
          await syncGithubRepo(boxId, {
            repoUrl: factory.githubRepoUrl,
            githubToken: factory.githubToken,
          });
        }

        await db.transact(
          db.tx.runs[payload.runId].update({
            sandboxId: boxId,
            status: "running",
          }),
        );
      } else {
        logger.log("Reusing existing box, killing previous exec", { boxId, engine });
        if (engine === "cursor") {
          await killRunningCursorExec(boxId);
        } else {
          await killRunningCodexExec(boxId);
        }

        if (factory.githubToken) {
          logger.log("Refreshing git credentials in box", { boxId });
          await configureGitInBox(boxId, factory.githubToken);
        }

        await db.transact(db.tx.runs[payload.runId].update({ status: "running" }));
      }

      let eventCount = 0;
      const execCwd = factory.githubRepoUrl ? factoryRepoDir : undefined;

      const onEvent = async (event: Record<string, unknown>) => {
        eventCount++;
        logger.log(`${engine} event #${eventCount}`, { event });

        const eventId = id();
        await db.transact([
          db.tx.events[eventId]
            .update({
              type: (event.type as string) ?? "unknown",
              data: event,
              createdAt: Date.now(),
            })
            .link({ run: payload.runId }),
        ]);
      };

      if (engine === "cursor") {
        if (!factory.cursorApiKey) {
          throw new Error(`Factory ${payload.factoryId} has no Cursor API key`);
        }

        logger.log("Starting cursor agent exec", {
          boxId,
          prompt: payload.prompt,
        });

        await streamCursorExec(
          boxId,
          { prompt: payload.prompt, cursorApiKey: factory.cursorApiKey, cwd: execCwd },
          onEvent,
        );
      } else {
        logger.log("Starting codex exec", {
          boxId,
          resume: isResume,
          prompt: payload.prompt,
        });

        await streamCodexExec(
          boxId,
          { prompt: payload.prompt, resume: isResume, cwd: execCwd, env: boxEnv },
          onEvent,
        );
      }

      logger.log(`${engine} exec finished`, { eventCount });

      await db.transact(db.tx.runs[payload.runId].update({ status: "idle" }));

      return { status: "idle", eventCount };
    } catch (error) {
      logger.error(`${engine} exec failed`, { error });

      await db.transact([
        db.tx.runs[payload.runId].update({ status: "failed" }),
        db.tx.events[id()]
          .update({
            type: "error",
            data: {
              message: error instanceof Error ? error.message : "Unknown error",
            },
            createdAt: Date.now(),
          })
          .link({ run: payload.runId }),
      ]);

      throw error;
    }
  },
});
