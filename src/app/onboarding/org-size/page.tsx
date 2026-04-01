"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { ArrowLeft, Building2, User, UsersRound } from "lucide-react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateOnboardingState } from "@/lib/api/onboarding";
import { getOnboardingRoute } from "@/lib/onboarding";

type OrgSizeChoice = "just_me" | "2_10" | "10_plus";

const ORG_OPTIONS: Array<{
  value: OrgSizeChoice;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { value: "just_me", label: "Just Me", Icon: User },
  { value: "2_10", label: "2 - 10 people", Icon: UsersRound },
  { value: "10_plus", label: "10+ people", Icon: Building2 },
];

export default function Page() {
  const router = useRouter();
  const [orgSize, setOrgSize] = useState<OrgSizeChoice>("just_me");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await updateOnboardingState({ role_fit: orgSize });
      if (updated) {
        router.push(
          getOnboardingRoute(updated.metadata.next_step, updated.completed),
        );
        return;
      }
    } catch (error) {
      console.error("Failed to update onboarding role fit", error);
    } finally {
      setIsSubmitting(false);
    }
    router.push("/onboarding/pricing");
  };

  return (
    <section className="w-full min-h-screen lg:h-screen p-6 bg-[#FAF9F8]">
      <div className="w-full h-full bg-linear-to-b from-blue-200 via-amber-200 to-blue-200 border border-zinc-600/40 rounded-[16px] shadow-md">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8 px-6 py-10">
          <div className="max-w-2xl w-full text-center flex flex-col items-center gap-4">
            <Image
              src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/image.png"
              width={500}
              height={500}
              alt="Souvenir Logo"
              className="w-14 h-14"
              unoptimized
            />
            <h3 className="font-besley text-4xl text-black">
              Which role fits you best?
            </h3>
            <p className="font-geist text-base md:text-lg text-[#525252]">
              Solo or with a team, start on any plan, upgrade when ready. No
              lock-ins.
            </p>
          </div>

          <RadioGroup
            value={orgSize}
            onValueChange={(v) => setOrgSize(v as OrgSizeChoice)}
            className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {ORG_OPTIONS.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="cursor-pointer relative rounded-[12px] border border-black/20 bg-[#191919] text-[#FFDB93] transition-all duration-200 px-5 py-6 min-h-[140px] flex flex-col items-center justify-center gap-4 hover:border-black/40 has-[button[data-state=checked]]:border-[#FFDB93] has-[button[data-state=checked]]:shadow-md has-[button[data-state=checked]]:shadow-black/25"
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

          <a
            href="https://getsouvenir.com/"
            className="inline-flex items-center gap-2 font-geist text-sm text-[#525252] hover:text-black transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Log out &amp; return to website
          </a>
        </div>
      </div>
    </section>
  );
}
