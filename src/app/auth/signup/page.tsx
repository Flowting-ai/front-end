'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { SIGNUP_ENDPOINT } from "@/lib/config";

export default function SignupPage() {
  const router = useRouter();
  const { setCsrfToken, csrfToken } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch(SIGNUP_ENDPOINT, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
        }
      } catch (err) {
        console.error("Failed to fetch CSRF token for signup", err);
      }
    };
    fetchCsrfToken();
  }, [setCsrfToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Unable to create account. Please try again.");
        return;
      }

      setSuccessMessage("Signup successful! Redirecting to login…");
      setTimeout(() => router.replace("/auth/login"), 1500);
    } catch (err) {
      console.error("Signup failed", err);
      setError("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#D9D9D9] bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#1E1E1E]">Create an account</h1>
          <p className="text-sm text-[#555555]">Sign up to start collaborating with FlowtingAi.</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="avnish"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="avnish@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a secure password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {successMessage && (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          )}
          <Button
            type="submit"
            className="w-full rounded-full bg-[#1E1E1E] text-white hover:bg-[#0F0F0F]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[#555555]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#1E1E1E] font-medium underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
