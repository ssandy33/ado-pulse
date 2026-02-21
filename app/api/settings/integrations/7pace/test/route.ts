import { NextResponse } from "next/server";
import { getSevenPaceConfig, sevenPaceFetch, SevenPaceApiError } from "@/lib/sevenPace";

interface SevenPaceUsersResponse {
  data: { id: string }[];
}

export async function GET() {
  try {
    const config = await getSevenPaceConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "7pace not configured. Save API token and base URL first." },
        { status: 400 }
      );
    }

    const result = await sevenPaceFetch<SevenPaceUsersResponse>(
      config,
      "users",
      { "api-version": "3.0" }
    );

    return NextResponse.json({
      success: true,
      userCount: result.data?.length ?? 0,
    });
  } catch (error) {
    if (error instanceof SevenPaceApiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status === 401 ? 401 : 502 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Unexpected error testing connection" },
      { status: 500 }
    );
  }
}
