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
import { Checkbox } from "@/components/ui/checkbox";

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
            src="/new-logos/FlowtingLogoBlack.svg"
            width={45}
            height={45}
            alt="Flowting Logo"
            className="w-10 h-10 object-contain"
          />
          <h1 className="font-clash font-normal text-[27px]">FlowtingAI</h1>
        </div>

        {/* Text */}
        <h3 className="z-2 absolute bottom-[5%] left-[5%] font-geist font-normal leading-[120%] text-[50px] text-black">
          Access your <br /> intelligent <br /> workspace
        </h3>
      </div>

      {/* Right */}
      <div className="w-full md:w-2/3 lg:w-6/11 h-full flex items-center justify-center">
        <div className="min-w-[320px] w-[625px] h-auto bg-white flex flex-col gap-6 px-6 pt-6">
          {/* Header */}
          <div className="w-full flex flex-col gap-2">
            <h1 className="form-title">
              Create an account
            </h1>
            <p className="form-tagline">
              <span className="font-bold">Sign up</span> to design, connect, and
              automate your AI systems, all in one place.
            </p>
          </div>

          {/* Form */}
          <form className="form-container" onSubmit={handleSubmit}>
            {/* Name Fields Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <Label
                  htmlFor="firstName"
                  className="form-label"
                >
                  First name
                </Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <Label
                  htmlFor="lastName"
                  className="form-label"
                >
                  Last name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="form-label"
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="form-input"
                required
              />
            </div>

            {/* Phone Field (optional) */}
            <div className="flex flex-col gap-2" >
              <Label
                htmlFor="phoneNumber"
                className="form-label"
              >
                Phone number (optional)
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="form-input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password Field */}
              <div className="flex flex-col gap-2" >
                <Label
                  htmlFor="password"
                  className="form-label"
                >
                  Password
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-2" >
                <Label
                  htmlFor="confirmPassword"
                  className="form-label"
                >
                  Confirm Password
                </Label>
                <div className="relative w-full">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="form-input"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="form-password-eye-btn"
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
            {error && <p className="form-error-message">{error}</p>}
            {successMessage && (
              <p className="form-success-message">{successMessage}</p>
            )}

            {/* Terms & Policy | Promotion Checkboxes */}
            <div className="pointer-events-none flex flex-col gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Checkbox disabled className="border border-main-border!" />
                <p className="text-balance text-sm text-[#1E1E1E]/30">
                  By creating an account, I agree to our
                  {" "}
                  <span>
                    <Link href="/terms-and-conditions" className="underline underline-offset-2">Terms of use</Link>
                  </span>
                  {" "}
                  and
                  {" "}
                  <span>
                    <Link href="/privacy-policy" className="underline underline-offset-2">Privacy Policy</Link>
                  </span>
                </p>
              </div>
              <div className="flex items-start justify-start gap-2">
                <Checkbox disabled className="border border-main-border!" />
                <p className="w-full text-balance text-sm text-[#1E1E1E]/30 leading-[120%]">
                  By creating an account, I am also consenting to receive SMS
                  messages and emails, including product new feature updates,
                  events, and marketing promotions.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Sign Up Button */}
              <Button
                type="submit"
                className="form-submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Create an account"}
              </Button>

              {/* Sign In Link */}
              <p className="font-poppins font-normal text-sm">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-poppins font-normal underline underline-offset-2 text-sm"
                >
                  Log in
                </Link>
              </p>
            </div>

            {/* Google Button - Disabled */}
            <Button
              disabled
              type="button"
              variant="outline"
              className="form-google-button"
            >
              <Image
                src="/googleLogo.svg"
                width={24}
                height={24}
                alt="Google Logo"
                className="h-5 w-5 object-contain"
              />
              <span className="font-inter font-semibold text-sm">
                Sign Up with Google
              </span>
            </Button>

            {/* Spacer */}
            <div className="flex-1 lg:hidden"></div>
          </form>
        </div>
      </div>
    </main>
  );
}
