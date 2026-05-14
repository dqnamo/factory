import { type NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
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

    const handle = await tasks.trigger<typeof executeFactoryRunTask>(
      "execute-factory-run",
      { runId, factoryId, prompt },
    );

    return NextResponse.json({ ok: true, triggerId: handle.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger run execution",
      },
      { status: 500 },
    );
  }
}
