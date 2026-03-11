"use client";

/**
 * Login page — Auth0 stub.
 *
 * TODO: When @auth0/nextjs-auth0 is installed, replace this page by:
 *   1. Creating src/app/api/auth/[auth0]/route.ts (Auth0 route handler).
 *   2. Redirecting here to the Auth0 Universal Login:
 *      router.push("/api/auth/login");
 *   3. Removing this file entirely — Auth0 handles the login UI.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // TODO: Replace with: router.push("/api/auth/login");
    // Auth0 will redirect to Universal Login automatically.
  }, [router]);

  return (
    <main className="min-h-screen w-full flex items-center justify-center">
      <p className="text-sm text-gray-500">
        Authentication is not yet configured.{" "}
        <span className="font-medium">Auth0 integration pending.</span>
      </p>
    </main>
  );
}
