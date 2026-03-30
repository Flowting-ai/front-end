import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/** Turn an Auth0 sub into a safe cookie name. */
function onboardingCookieName(sub: string): string {
  return `ob_${sub.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export async function POST() {
  const session = await auth0.getSession();

  if (!session?.user?.sub) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const sub = session.user.sub as string;

  const response = NextResponse.json({ success: true });
  response.cookies.set(onboardingCookieName(sub), "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
