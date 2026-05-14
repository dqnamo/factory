import { type NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { setupFactoryTask } from "@/trigger/setup-factory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { factoryId } = body as { factoryId?: string };

    if (!factoryId) {
      return NextResponse.json(
        { error: "factoryId is required" },
        { status: 400 },
      );
    }

    const handle = await tasks.trigger<typeof setupFactoryTask>(
      "setup-factory",
      { factoryId },
    );

    return NextResponse.json({ ok: true, runId: handle.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger factory setup",
      },
      { status: 500 },
    );
  }
}
