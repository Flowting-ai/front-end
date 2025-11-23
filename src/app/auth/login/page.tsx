'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { LOGIN_ENDPOINT } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, csrfToken, setCsrfToken } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Prime CSRF token from backend (cookie + payload)
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch(LOGIN_ENDPOINT, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
        }
      } catch (fetchError) {
        console.error("Failed to obtain CSRF token", fetchError);
      }
    };
    fetchCsrfToken();
  }, [setCsrfToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const payload =
      identifier.includes("@")
        ? { email: identifier.trim(), username: "", password }
        : { username: identifier.trim(), email: "", password };

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Unable to login. Please try again.");
        return;
      }

      if (data?.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("isLoggedIn", "true");
        }
      }
      router.replace("/");
    } catch (submitError) {
      console.error("Login failed", submitError);
      setError("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#D9D9D9] bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#1E1E1E]">Welcome back</h1>
          <p className="text-sm text-[#555555]">Log in to continue your chats.</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="identifier">Username or Email</Label>
            <Input
              id="identifier"
              placeholder="avnish or avnish@example.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full rounded-full bg-[#1E1E1E] text-white hover:bg-[#0F0F0F]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[#555555]">
          New here?{" "}
          <Link href="/auth/signup" className="text-[#1E1E1E] font-medium underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
