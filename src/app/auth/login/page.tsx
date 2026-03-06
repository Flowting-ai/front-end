"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { LOGIN_ENDPOINT } from "@/lib/config";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setJwtToken, setRefreshToken } = useAuth();
  type LoginSuccess = {
    message?: string;
    token?: string;
    refreshToken?: string;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = { email: email.trim(), password };

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: LoginSuccess & LoginError = await response.json();
      if (!response.ok) {
        setError(
          data?.error || data?.detail || "Unable to login. Please try again.",
        );
        return;
      }

      if (data?.token) setJwtToken(data.token);
      if (data?.refreshToken) setRefreshToken(data.refreshToken);

      if (data?.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("isLoggedIn", "true");
          // Signal the app layout to start a fresh chat after login
          localStorage.setItem("startNewChatOnLogin", "true");
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
    <main className="relative min-h-screen w-full bg-white flex items-center justify-center px-4 lg:px-6">
      {/* Left */}
      <div className="hidden relative w-5/11 h-full max-h-[94vh] rounded-lg lg:flex items-center justify-center overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="z-0 w-full h-full object-cover blur-none aspect-4/5"
        >
          <source src={"/blueBg.mp4"} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Radial Gradient Layer */}
        <div className="z-1 absolute inset-0 w-full h-full bg-radial from-transparent to-white/20 backdrop-blur-md"></div>

        {/* Logo */}
        <div className="z-2 scale-100 absolute top-[5%] left-[5%] w-auto h-auto flex items-center gap-3">
          <Image
            src="/new-logos/souvenir-logo.svg"
            width={45}
            height={45}
            alt="Souvenir AI Logo"
            className="w-10 h-10 object-contain"
          />
          <h1 className="font-clash font-normal text-[27px]">SouvenirAI</h1>
        </div>

        {/* Text */}
        <h3 className="z-2 absolute bottom-[5%] left-[5%] font-geist font-normal leading-[120%] text-[50px] text-black">
          Access your <br /> intelligent <br /> workspace
        </h3>
      </div>

      {/* Right */}
      <div className="w-full md:w-2/3 lg:w-6/11 h-full flex items-center justify-center">
        <div className="min-w-[320px] w-[625px] min-h-[472px] bg-white flex flex-col gap-6 px-6 pt-6">
          {/* Header */}
          <div className="w-full max-w-[540px] flex flex-col gap-2">
            <h1 className="form-title">
              Welcome to SouvenirAI
            </h1>
            <p className="form-tagline">
              <span className="font-bold">Log in</span> to orchestrate
              workflows, manage personas, and run
              automations in real time.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col flex-1 gap-4" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="identifier"
                className="form-label text-[15px] whitespace-pre"
              >
                Email address<span className="text-zinc-400">*</span>
              </Label>
              <Input
                id="identifier"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="form-input"
                required
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="password"
                className="form-label text-[15px]"
              >
                Password <span className="text-zinc-400">*</span>
              </Label>
              <div className="relative w-full">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="form-password-eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {/* error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Login Button */}
              <Button
                type="submit"
                className="form-submit-button w-full! md:w-auto!"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Log in"}
              </Button>

              {/* Sign Up Link */}
              <p className="font-poppins font-normal text-sm">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-poppins font-normal underline underline-offset-2 text-sm"
                >
                  Sign Up
                </Link>
              </p>
            </div>

            {/* Google Button */}
            <Button
            disabled
              type="button"
              variant="outline"
              className="form-google-button"
            >
              <Image
                src="/company-logos/google.svg"
                width={24}
                height={24}
                alt="Google Logo"
                className="h-5 w-5 object-contain"
              />
              <span className="font-inter font-semibold text-sm">
                Sign In with Google
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
