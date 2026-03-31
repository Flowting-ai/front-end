"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  ArrowLeft,
  Building2,
  GraduationCap,
  Brush,
  FileCode2,
  Store,
  Microscope,
  ChartNoAxesCombined,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateOnboardingState } from "@/lib/api/onboarding";
import { getOnboardingRoute } from "@/lib/onboarding";

type RoleChoice =
  | "founder"
  | "student"
  | "creator"
  | "engineer"
  | "marketing_sales"
  | "researcher"
  | "enterprise"
  | "other";

const ROLE_OPTIONS: Array<{
  value: RoleChoice;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { value: "founder", label: "Founder", Icon: Building2 },
  { value: "student", label: "Student", Icon: GraduationCap },
  { value: "creator", label: "Creator", Icon: Brush },
  { value: "engineer", label: "Engineer", Icon: FileCode2 },
  { value: "marketing_sales", label: "Marketing/Sales", Icon: Store },
  { value: "researcher", label: "Researcher", Icon: Microscope },
  { value: "enterprise", label: "Enterprise", Icon: ChartNoAxesCombined },
  { value: "other", label: "Other", Icon: UsersRound },
];

export default function Page() {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>("founder");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await updateOnboardingState({ user_role: role });
      if (updated) {
        router.push(
          getOnboardingRoute(updated.metadata.next_step, updated.completed),
        );
        return;
      }
    } catch (error) {
      console.error("Failed to update onboarding role", error);
    } finally {
      setIsSubmitting(false);
    }
    router.push("/onboarding/tone");
  };

  return (
    <section className="w-full min-h-screen lg:h-screen p-6 bg-[#FAF9F8]">
      <div className="w-full h-full bg-linear-to-b from-blue-200 via-amber-200 to-blue-200 border border-zinc-600/40 rounded-[16px] shadow-md">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8 px-6 py-10">
          <div className="max-w-2xl w-full text-center flex flex-col items-center gap-4">
            <Image
              src="/new-logos/souvenir-logo.svg"
              width={500}
              height={500}
              alt="Souvenir Logo"
              className="w-14 h-14"
              unoptimized
            />
            <h3 className="font-besley text-4xl text-black">
              What best describes you?
            </h3>
            <p className="font-geist text-base md:text-lg text-[#525252]">
              We make sure your first session feels like it was built for you.
            </p>
          </div>

          <RadioGroup
            value={role}
            onValueChange={(v) => setRole(v as RoleChoice)}
            className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {ROLE_OPTIONS.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="cursor-pointer relative rounded-[12px] border border-black/20 bg-[#191919] text-[#FFDB93] transition-all duration-200 px-4 py-5 min-h-[120px] flex flex-col items-center justify-center gap-3 hover:border-black/40 has-[button[data-state=checked]]:border-[#FFDB93] has-[button[data-state=checked]]:shadow-md has-[button[data-state=checked]]:shadow-black/25"
              >
                <RadioGroupItem
                  value={value}
                  className="absolute top-3 left-3 h-5 w-5 border-[#FFDB93] data-[state=checked]:text-[#FFDB93]"
                />
                <Icon size={24} strokeWidth={1.4} />
                <span className="font-geist text-sm font-medium text-center leading-tight">
                  {label}
                </span>
              </label>
            ))}
          </RadioGroup>

          <div className="w-full max-w-3xl flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onContinue}
              disabled={isSubmitting}
              className="cursor-pointer h-10 px-5 rounded-[8px] border border-black text-black bg-transparent hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={isSubmitting}
              className="cursor-pointer h-10 px-6 rounded-[8px] border border-black bg-black text-white hover:bg-[#0A0A0A] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>

          <Link
            href="https://getsouvenir.com/"
            className="inline-flex items-center gap-2 font-geist text-sm text-[#525252] hover:text-black transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Log out &amp; return to website
          </Link>
        </div>
      </div>
    </section>
  );
}
