import { NextRequest, NextResponse } from "next/server";
import { runSchedulerNow } from "@/lib/scheduler";

export async function POST(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = request.headers.get("x-admin-secret");

  if (!adminSecret || provided !== adminSecret) {
    return NextResponse.json(
      { error: "Unauthorized — invalid or missing admin secret" },
      { status: 401 }
    );
  }

  try {
    const result = await runSchedulerNow();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduler run failed" },
      { status: 500 }
    );
  }
}
