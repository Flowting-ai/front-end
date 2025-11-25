'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { LOGIN_ENDPOINT } from "@/lib/config";
import { GoogleLogo } from "@/components/icons/google-logo";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, csrfToken, setCsrfToken } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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

    // Test credentials bypass for development
    if (identifier === "admin@gmail.com" && password === "admintesting@4321") {
      const testUser = {
        id: "test-user-1",
        email: "admin@gmail.com",
        username: "Admin User",
      };
      setUser(testUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("isLoggedIn", "true");
      }
      router.replace("/");
      setIsSubmitting(false);
      return;
    }

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
    <main className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div 
        className="bg-white flex flex-col" 
        style={{ 
          width: '625px', 
          height: '800px', 
          minWidth: '320px', 
          padding: '48px',
          gap: '24px'
        }}
      >
        {/* Header */}
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <h1 className="text-3xl font-semibold text-[#1E1E1E]">Log in</h1>
          <p className="text-sm text-[#666666]">Welcome back! Please enter your details.</p>
        </div>

        {/* Form */}
        <form className="flex flex-col flex-1" style={{ gap: '24px' }} onSubmit={handleSubmit}>
          {/* Email Field */}
          <div className="flex flex-col" style={{ gap: '8px' }}>
            <Label htmlFor="identifier" className="text-sm font-medium text-[#1E1E1E]">
              Email address
            </Label>
            <Input
              id="identifier"
              type="email"
              placeholder="Email address"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="rounded-lg border-[#D4D4D4] text-[#1E1E1E]"
              style={{ 
                width: '100%', 
                height: '40px',
                padding: '8px 12px'
              }}
              required
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col" style={{ gap: '8px' }}>
            <Label htmlFor="password" className="text-sm font-medium text-[#1E1E1E]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border-[#D4D4D4] text-[#1E1E1E]"
              style={{ 
                width: '100%', 
                height: '40px',
                padding: '8px 12px'
              }}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Login Button */}
          <Button
            type="submit"
            className="w-full bg-[#1E1E1E] text-white hover:bg-[#0F0F0F] rounded-lg"
            style={{ height: '48px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Log in"}
          </Button>

          {/* Google Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] border border-[#767676] rounded-lg flex items-center justify-center gap-3"
            style={{ 
              height: '48px',
              paddingLeft: '215px',
              paddingRight: '215px'
            }}
          >
            <GoogleLogo className="h-5 w-5" />
            <span>Log in with Google</span>
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer Link */}
          <p className="text-center text-sm text-[#666666]">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-[#1E1E1E] font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
