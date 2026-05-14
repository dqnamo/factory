import { tasks } from "@trigger.dev/sdk/v3";
import { type NextRequest, NextResponse } from "next/server";
import { errorResponse, requireFactoryMember } from "@/app/lib/server-auth";
import type { setupFactoryTask } from "@/trigger/setup-factory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { factoryId } = body as { factoryId?: string };

    if (!factoryId) {
      return NextResponse.json({ error: "factoryId is required" }, { status: 400 });
    }

    await requireFactoryMember(request, factoryId);

    const handle = await tasks.trigger<typeof setupFactoryTask>("setup-factory", { factoryId });

    return NextResponse.json({ ok: true, runId: handle.id });
  } catch (error) {
    return errorResponse(error, "Failed to trigger factory setup");
  }
}
