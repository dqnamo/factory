import { tasks } from "@trigger.dev/sdk/v3";
import { type NextRequest, NextResponse } from "next/server";
import { errorResponse, requireFactoryMember, requireRunInFactory } from "@/app/lib/server-auth";
import type { executeFactoryRunTask } from "@/trigger/execute-factory-run";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, factoryId, prompt } = body as {
      runId?: string;
      factoryId?: string;
      prompt?: string;
    };

    if (!runId || !factoryId || !prompt) {
      return NextResponse.json(
        { error: "runId, factoryId, and prompt are required" },
        { status: 400 },
      );
    }

    await requireFactoryMember(request, factoryId);
    await requireRunInFactory(factoryId, runId);

    const handle = await tasks.trigger<typeof executeFactoryRunTask>("execute-factory-run", {
      runId,
      factoryId,
      prompt,
    });

    return NextResponse.json({ ok: true, triggerId: handle.id });
  } catch (error) {
    return errorResponse(error, "Failed to trigger run execution");
  }
}
