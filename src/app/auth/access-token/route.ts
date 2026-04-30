import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export async function GET() {
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined;

  try {
    const { token } = await auth0.getAccessToken({ audience });
    return NextResponse.json({ token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch access token";
    return NextResponse.json(
      { error: { code: "access_token_error", message } },
      { status: 401 },
    );
  }
}
