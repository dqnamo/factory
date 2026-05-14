import { db } from "@/app/lib/admin-db";

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireInstantUser(request: Request): Promise<AuthenticatedUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new HttpError(401, "Authentication required.");
  }

  const user = await db.auth.getUser({ refresh_token: token });

  if (!user?.id) {
    throw new HttpError(401, "Invalid authentication token.");
  }

  return user;
}

export async function requireFactoryMember(request: Request, factoryId: string) {
  const user = await requireInstantUser(request);
  const isMember = await isFactoryMember(user.id, factoryId);

  if (!isMember) {
    throw new HttpError(403, "You do not have access to this factory.");
  }

  return user;
}

export async function requireRunInFactory(factoryId: string, runId: string) {
  const result = await db.query({
    runs: {
      $: {
        where: {
          "factory.id": factoryId,
          id: runId,
        },
        limit: 1,
      },
    },
  });

  if (result.runs.length === 0) {
    throw new HttpError(404, "Run not found for this factory.");
  }
}

export async function isFactoryMember(userId: string, factoryId: string) {
  const result = await db.query({
    factoryUsers: {
      $: {
        where: {
          "factory.id": factoryId,
          "user.id": userId,
        },
        limit: 1,
      },
    },
  });

  return result.factoryUsers.length > 0;
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}
