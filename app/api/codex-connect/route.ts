import { type NextRequest, NextResponse } from "next/server";
import { getBoxCodexStatus, startBoxCodexLogin } from "@/app/lib/box-codex";
import { errorResponse, requireInstantUser } from "@/app/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    await requireInstantUser(request);
    const body = await request.json();
    const { boxId } = body as { boxId?: string };

    const result = await startBoxCodexLogin(boxId);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Failed to start Codex login");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireInstantUser(request);
  } catch (error) {
    return errorResponse(error, "Failed to authenticate request");
  }

  const boxId = request.nextUrl.searchParams.get("boxId");

  if (!boxId) {
    return NextResponse.json({ error: "boxId is required" }, { status: 400 });
  }

  try {
    const status = await getBoxCodexStatus(boxId);
    return NextResponse.json({ status, boxId });
  } catch (error) {
    return errorResponse(error, "Failed to check status");
  }
}
