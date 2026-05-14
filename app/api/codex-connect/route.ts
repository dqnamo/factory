import { type NextRequest, NextResponse } from "next/server";
import {
  startBoxCodexLogin,
  getBoxCodexStatus,
} from "@/app/lib/box-codex";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boxId } = body as { boxId?: string };

    const result = await startBoxCodexLogin(boxId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Codex login" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const boxId = request.nextUrl.searchParams.get("boxId");

  if (!boxId) {
    return NextResponse.json(
      { error: "boxId is required" },
      { status: 400 },
    );
  }

  try {
    const status = await getBoxCodexStatus(boxId);
    return NextResponse.json({ status, boxId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 },
    );
  }
}
