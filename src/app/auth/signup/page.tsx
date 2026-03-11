"use client";

/**
 * Signup page — Auth0 stub.
 *
 * TODO: When @auth0/nextjs-auth0 is installed, replace this page by:
 *   1. Redirecting to the Auth0 signup screen:
 *      router.push("/api/auth/login?screen_hint=signup");
 *   2. Removing this file entirely — Auth0 handles registration.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  void router;

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center gap-4">
      <p className="text-sm text-gray-500">
        Registration is not yet configured.{" "}
        <span className="font-medium">Auth0 integration pending.</span>
      </p>
      <Link href="/auth/login" className="text-sm underline underline-offset-2">
        Back to login
      </Link>
    </main>
  );
}
