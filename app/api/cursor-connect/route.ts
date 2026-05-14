import { type NextRequest, NextResponse } from "next/server";
import {
  createBoxForCursorFactory,
  validateCursorApiKey,
} from "@/app/lib/box-cursor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cursorApiKey } = body as { cursorApiKey?: string };

    if (!cursorApiKey) {
      return NextResponse.json(
        { error: "cursorApiKey is required" },
        { status: 400 },
      );
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to set up Cursor connection",
      },
      { status: 500 },
    );
  }
}
