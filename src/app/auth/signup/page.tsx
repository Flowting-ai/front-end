"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { CSRF_INIT_ENDPOINT, SIGNUP_ENDPOINT } from "@/lib/config";
import { GoogleLogo } from "@/components/icons/google-logo";
import Image from "next/image";

export default function SignupPage() {
  const router = useRouter();
  const { setCsrfToken, csrfToken } = useAuth();
  type SignupSuccess = {
    message?: string;
    csrfToken?: string;
    csrf_token?: string;
    user?: {
      id?: string | number;
      username?: string | null;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phoneNumber?: string | null;
    };
  };
  type SignupError = { error?: string; detail?: string };
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        await fetch(CSRF_INIT_ENDPOINT, {
          method: "GET",
          credentials: "include",
        });
      } catch (err) {
        console.warn("CSRF init failed for signup", err);
      }
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
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
          username:
            `${firstName.trim()} ${lastName.trim()}`.trim() || email.trim(),
          email: email.trim(),
          password,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });

      const data: SignupSuccess & SignupError = await response.json();
      if (!response.ok) {
        setError(
          data?.error ||
            data?.detail ||
            "Unable to create account. Please try again.",
        );
        return;
      }

      const freshToken = data?.csrfToken || data?.csrf_token;
      if (freshToken) {
        setCsrfToken(freshToken);
      }

      setSuccessMessage(
        data?.message || "Signup successful! Please sign in to continue.",
      );
      setTimeout(() => router.replace("/auth/login"), 1000);
    } catch (err) {
      console.error("Signup failed", err);
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
        <div className="min-w-[320px] w-[625px] h-auto bg-white border border-main-border rounded-lg flex flex-col gap-6 px-6 pt-6">
          {/* Header */}
          <div className="w-[540px] flex flex-col gap-2">
            <h1 className="font-poppins font-medium text-3xl text-[#333333]">
              Access your intelligent workspace
            </h1>
            <p className="font-inter text-[16px] text-sm text-[#1E1E1E]">
              <span className="font-bold">Sign up</span> to design, connect, and
              automate your AI systems, all in one place.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col flex-1 gap-6" onSubmit={handleSubmit}>
            {/* Name Fields Row */}
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <Label
                  htmlFor="firstName"
                  className="font-inter font-normal text-[16px] text-[#1E1E1E]"
                >
                  First name
                </Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                  required
                />
              </div>
              <div className="flex flex-col" style={{ gap: "8px", flex: 1 }}>
                <Label
                  htmlFor="lastName"
                  className="font-inter font-normal text-[16px] text-[#1E1E1E]"
                >
                  Last name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="flex flex-col" style={{ gap: "8px" }}>
              <Label
                htmlFor="email"
                className="font-inter font-normal text-[16px] text-[#1E1E1E]"
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                required
              />
            </div>

            {/* Phone Field (optional) */}
            <div className="flex flex-col" style={{ gap: "8px" }}>
              <Label
                htmlFor="phoneNumber"
                className="font-inter font-normal text-[16px] text-[#1E1E1E]"
              >
                Phone number (optional)
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col" style={{ gap: "8px" }}>
                <Label
                  htmlFor="confirmPassword"
                  className="font-inter font-normal text-[16px] text-[#1E1E1E]"
                >
                  Confirm Password
                </Label>
                <div style={{ position: "relative", width: "100%" }}>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full h-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] placeholder:text-[#B3B3B3] bg-white border border-[#D9D9D9] rounded-[8px] px-4 py-3"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((v) => !v)}
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
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {/* error */}
            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}
            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}

            <div className="flex items-center gap-6">
              {/* Sign Up Button */}
              <Button
                type="submit"
                className="cursor-pointer min-w-[81px] w-auto h-[40px] font-inter font-normal text-[16px] text-[#F5F5F5] bg-[#2C2C2C] hover:bg-[#0F0F0F] rounded-[8px] transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Sign up"}
              </Button>

              {/* Sign In Link */}
              <p className="font-poppins font-normal text-[16px]">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-poppins font-normal underline underline-offset-2 text-[16px]"
                >
                  Log in
                </Link>
              </p>
            </div>

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
                Sign Up with Google
              </span>
            </Button>

            {/* Spacer */}
            <div className="flex-1" />
          </form>
        </div>
      </div>
    </main>
  );
}
