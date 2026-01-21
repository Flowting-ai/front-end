"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { CSRF_INIT_ENDPOINT, LOGIN_ENDPOINT } from "@/lib/config";
import { GoogleLogo } from "@/components/icons/google-logo";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, csrfToken, setCsrfToken } = useAuth();
  type LoginSuccess = {
    message?: string;
    csrfToken?: string;
    csrf_token?: string;
    user?: {
      id?: string | number;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
    };
  };
  type LoginError = { error?: string; detail?: string };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        await fetch(CSRF_INIT_ENDPOINT, {
          method: "GET",
          credentials: "include",
        });
      } catch (fetchError) {
        console.warn("CSRF init failed", fetchError);
      }
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

    const payload = identifier.includes("@")
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

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

      const data: LoginSuccess & LoginError = await response.json();
      if (!response.ok) {
        setError(data?.error || data?.detail || "Unable to login. Please try again.");
        return;
      }

      const freshToken = data?.csrfToken || data?.csrf_token;
      if (freshToken) {
        setCsrfToken(freshToken);
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
    <main className="relative min-h-screen w-full bg-[#F5F5F5] flex items-center justify-center">
      {/* Logo */}
      <div className="scale-100 absolute top-[48px] left-[53px] min-w-[340] w-[340] min-h-[82] h-[82] flex items-center gap-5">
        <Image
          src="/icons/logo.png"
          width={82}
          height={82}
          alt="Auth Logo Clumped"
          className="w-[82px] h-[82px] object-contain"
        />
        <h1 className="font-clash font-normal text-[54px]">FlowtingAi</h1>
      </div>

      {/* Left */}
      <div className="w-1/2 h-full flex items-center justify-center">
        <Image
          src="/icons/AuthLogoClump.svg"
          width={500}
          height={500}
          alt="Auth Logo Clumped"
          className="w-[500] h-[500] object-contain"
        />
      </div>

      {/* Right */}
      <div className="w-1/2 h-full flex items-center justify-center">
        <div className="min-w-[320px] w-[625px] h-[472px] bg-white border border-main-border rounded-lg flex flex-col gap-6 p-6">
          {/* Header */}
          <div className="w-[540px] flex flex-col gap-2">
            <h1 className="font-poppins font-medium text-3xl text-[#333333]">
              Welcome back to Flowting AI
            </h1>
            <p className="font-inter text-[16px] text-sm text-[#1E1E1E]">
              <span className="font-bold">Log in</span> to orchestrate
              workflows, manage personas, and run
              <br />
              automations in real time.
            </p>
          </div>

          {/* Form */}
          <form
            className="flex flex-col flex-1 gap-6"
            onSubmit={handleSubmit}
          >
            {/* Google Button */}
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer w-full h-[48px] text-[#1E1E1E] bg-[#E3E3E3] hover:bg-[#1E1E1E] hover:text-[#E3E3E3] border border-[#767676] rounded-[8px] flex items-center justify-center gap-3 transition-all duration-300"
            >
              <Image
                src="/googleLogo.svg"
                width={24}
                height={24}
                alt="Google Logo"
                className="h-6 w-6 object-contain"
              />
              <span className="font-inter font-normal text-[16px]">
                Sign In with Google
              </span>
            </Button>

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="identifier"
                className="font-inter font-normal text-[16px] text-[#1E1E1E]"
              >
                Email address
              </Label>
              <Input
                id="identifier"
                type="email"
                placeholder="Email address"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                required
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col" style={{ gap: "8px" }}>
              <Label
                htmlFor="password"
                className="font-inter font-normal text-[16px] text-[#1E1E1E]"
              >
                Password
              </Label>
              <div style={{ position: "relative", width: "100%" }}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    color: "#888",
                    height: 24,
                    width: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-6">
              {/* Login Button */}
              <Button
                type="submit"
                className="cursor-pointer min-w-[70px] w-[70px] h-[40px] font-inter font-normal text-[16px] text-[#F5F5F5] bg-[#2C2C2C] hover:bg-[#0F0F0F] rounded-[8px] transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Log in"}
              </Button>

              {/* Sign Up Link */}
              <p className="font-poppins font-normal text-[16px]">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-poppins font-normal underline underline-offset-2 text-[16px]"
                >
                  Sign Up
                </Link>
              </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />
          </form>
        </div>
      </div>
    </main>
  );
}
