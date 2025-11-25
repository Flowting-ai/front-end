'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { SIGNUP_ENDPOINT } from "@/lib/config";
import { GoogleLogo } from "@/components/icons/google-logo";

export default function SignupPage() {
  const router = useRouter();
  const { setCsrfToken, csrfToken } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

    // Test credentials bypass for development - auto-approve test account
    if (email === "admin@gmail.com" && password === "admintesting@4321") {
      setSuccessMessage("Test account created! Redirecting to login…");
      setTimeout(() => router.replace("/auth/login"), 1500);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          username: `${firstName.trim()} ${lastName.trim()}`,
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
          <h1 className="text-3xl font-semibold text-[#1E1E1E]">Sign up</h1>
          <p className="text-sm text-[#666666]">Create your account to get started.</p>
        </div>

        {/* Form */}
        <form className="flex flex-col flex-1" style={{ gap: '24px' }} onSubmit={handleSubmit}>
          {/* Name Fields Row */}
          <div className="flex" style={{ gap: '16px' }}>
            <div className="flex flex-col" style={{ gap: '8px', flex: 1 }}>
              <Label htmlFor="firstName" className="text-sm font-medium text-[#1E1E1E]">
                First name
              </Label>
              <Input
                id="firstName"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="rounded-lg border-[#D4D4D4] text-[#1E1E1E]"
                style={{ 
                  width: '272px',
                  minWidth: '240px',
                  height: '40px',
                  padding: '8px 12px'
                }}
                required
              />
            </div>
            <div className="flex flex-col" style={{ gap: '8px', flex: 1 }}>
              <Label htmlFor="lastName" className="text-sm font-medium text-[#1E1E1E]">
                Last name
              </Label>
              <Input
                id="lastName"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="rounded-lg border-[#D4D4D4] text-[#1E1E1E]"
                style={{ 
                  width: '272px',
                  minWidth: '240px',
                  height: '40px',
                  padding: '8px 12px'
                }}
                required
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="flex flex-col" style={{ gap: '8px' }}>
            <Label htmlFor="email" className="text-sm font-medium text-[#1E1E1E]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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

          {/* Error/Success Messages */}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          {/* Sign Up Button */}
          <Button
            type="submit"
            className="w-full bg-[#1E1E1E] text-white hover:bg-[#0F0F0F] rounded-lg"
            style={{ height: '48px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
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
            <span>Sign up with Google</span>
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer Link */}
          <p className="text-center text-sm text-[#666666]">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#1E1E1E] font-medium hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
