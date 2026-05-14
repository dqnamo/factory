import { db } from "@/app/lib/admin-db";
import { errorResponse, requireFactoryMember } from "@/app/lib/server-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ factoryId: string }>;
};

type UpdateGithubRequest = {
  gitEmail?: string;
  gitName?: string;
  githubRepoUrl?: string;
  githubToken?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { factoryId } = await context.params;

  try {
    await requireFactoryMember(request, factoryId);

    const body = (await request.json()) as UpdateGithubRequest;
    const gitEmail = body.gitEmail?.trim();
    const gitName = body.gitName?.trim();
    const githubRepoUrl = body.githubRepoUrl?.trim();
    const githubToken = body.githubToken?.trim();

    if (!githubRepoUrl) {
      return Response.json({ error: "githubRepoUrl is required." }, { status: 400 });
    }

    if (gitEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gitEmail)) {
      return Response.json({ error: "gitEmail must be a valid email address." }, { status: 400 });
    }

    const update: {
      gitEmail?: string;
      gitName?: string;
      githubRepoUrl: string;
      githubToken?: string;
      githubTokenSet?: boolean;
    } = {
      githubRepoUrl,
    };

    if (body.gitEmail !== undefined) {
      update.gitEmail = gitEmail ?? "";
    }

    if (body.gitName !== undefined) {
      update.gitName = gitName ?? "";
    }

    if (githubToken) {
      update.githubToken = githubToken;
      update.githubTokenSet = true;
    }

    await db.transact(db.tx.factories[factoryId].update(update));

    return Response.json({ ok: true, githubTokenSet: true });
  } catch (error) {
    return errorResponse(error, "GitHub settings could not be saved.");
  }
}
