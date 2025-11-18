"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleLogo } from "@/components/icons/google-logo";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth, type AuthUser } from "@/context/auth-context";
import { LOGIN_ENDPOINT } from "@/lib/config";

const CSRF_COOKIE_NAME = "csrftoken";

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/([$?*|{}\[\]\\\/\+^])/g, "\\$1")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
};

const normalizeUser = (payload: unknown, fallbackEmail: string | null): AuthUser => {
  if (!payload || typeof payload !== "object") {
    return { email: fallbackEmail ?? null };
  }

  const data = payload as Record<string, unknown>;
  const email =
    (typeof data.email === "string" && data.email) ?? fallbackEmail ?? null;
  const name =
    (typeof data.name === "string" && data.name) ||
    (typeof data.full_name === "string" && data.full_name) ||
    (typeof data.username === "string" && data.username) ||
    null;
  const id =
    data.id ?? data.user_id ?? data.pk ?? null;

  return {
    ...data,
    id: typeof id === "string" || typeof id === "number" ? id : null,
    email,
    name,
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setCsrfToken } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [csrfToken, setLocalCsrfToken] = useState<string | null>(null);

  const requestCsrfToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch CSRF token");
      }

      let token =
        response.headers.get("X-CSRFToken") ||
        response.headers.get("x-csrftoken");

      if (!token) {
        try {
          const payload = (await response.clone().json()) as
            | Record<string, unknown>
            | undefined;
          if (payload) {
            const possibleToken =
              (typeof payload.csrfToken === "string" && payload.csrfToken) ||
              (typeof payload.csrftoken === "string" && payload.csrftoken) ||
              (typeof payload.csrf === "string" && payload.csrf) ||
              (typeof payload.token === "string" && payload.token);
            token = possibleToken ?? null;
          }
        } catch {
          // non-JSON response is okay
        }
      }

      if (!token) {
        token = getCookie(CSRF_COOKIE_NAME);
      }

      if (!token) {
        throw new Error("CSRF token missing from response");
      }

      setLocalCsrfToken(token);
      setCsrfToken(token);
      return token;
    } catch (err) {
      console.error("Unable to prepare CSRF token:", err);
      setError("Unable to reach the authentication service. Please try again.");
      return null;
    }
  }, [setCsrfToken, setError]);

  useEffect(() => {
    requestCsrfToken();
  }, [requestCsrfToken]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
      setLoading(false);
      setError("Please provide both email and password.");
      return;
    }

    try {
      let tokenToUse = csrfToken;
      if (!tokenToUse) {
        tokenToUse = await requestCsrfToken();
      }

      if (!tokenToUse) {
        throw new Error("Unable to verify request. Please refresh and try again.");
      }

      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": tokenToUse,
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();
      console.log("STATUS:", res.status, "BODY:", data);

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("isLoggedIn", "true");
      const fallbackEmail = typeof email === "string" ? email : null;
      const normalizedUser = normalizeUser(
        data?.user ?? data?.profile ?? data,
        fallbackEmail
      );
      setUser(normalizedUser);

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Access your intelligent workspace
        </h2>
        <p className="mt-2 text-muted-foreground">
          Log in to design, connect, and automate your AI systems, all in one place.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSignIn}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="#" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">
                {showPassword ? "Hide password" : "Show password"}
              </span>
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </div>
      </form>

      {/* rest of your UI... */}
    </div>
  );
}
