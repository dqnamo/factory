import { type NextRequest, NextResponse } from "next/server";
import { createBoxForCursorFactory, validateCursorApiKey } from "@/app/lib/box-cursor";
import { errorResponse, requireInstantUser } from "@/app/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    await requireInstantUser(request);
    const body = await request.json();
    const { cursorApiKey } = body as { cursorApiKey?: string };

    if (!cursorApiKey) {
      return NextResponse.json({ error: "cursorApiKey is required" }, { status: 400 });
    }

    const valid = await validateCursorApiKey(cursorApiKey);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid Cursor API key. Keys should start with cursor_" },
        { status: 400 },
      );
    }

    const boxId = await createBoxForCursorFactory(cursorApiKey);

    return NextResponse.json({
      status: "authenticated",
      boxId,
    });
  } catch (error) {
    return errorResponse(error, "Failed to set up Cursor connection");
  }
}
