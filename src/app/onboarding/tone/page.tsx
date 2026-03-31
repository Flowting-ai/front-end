"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

type ToneChoice =
  | "professional"
  | "balanced"
  | "casual"
  | "concise"
  | "creative"
  | "academic"
  | "witty"
  | "socratic"
  | "empathetic"
  | "executive"
  | "teaching"
  | "other";

const TONE_LABELS: Array<{ value: ToneChoice; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "balanced", label: "Balanced" },
  { value: "casual", label: "Casual" },
  { value: "concise", label: "Concise" },
  { value: "creative", label: "Creative" },
  { value: "academic", label: "Academic" },
  { value: "witty", label: "Witty" },
  { value: "socratic", label: "Socratic" },
  { value: "empathetic", label: "Empathetic" },
  { value: "executive", label: "Executive" },
  { value: "teaching", label: "Teaching" },
  { value: "other", label: "Other" },
];

export default function Page() {
  const router = useRouter();
  const [tone, setTone] = useState<ToneChoice>("balanced");
  const [customTone, setCustomTone] = useState("");

  const nextHref = useMemo(() => "/onboarding/org-size", []);

  const onContinue = () => {
    router.push(nextHref);
  };

  const showCustom = tone === "other";

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
            <h3 className="font-besley text-4xl text-black">Set your AI tone</h3>
            <p className="font-geist text-base md:text-lg text-[#525252]">
              This isn&apos;t just a preference, it&apos;s how every AI in your
              workspace will respond to you. You can adjust this any time in
              settings.
            </p>
          </div>

          <RadioGroup
            value={tone}
            onValueChange={(v) => setTone(v as ToneChoice)}
            className="w-full max-w-4xl flex items-center justify-center flex-wrap gap-3"
          >
            {TONE_LABELS.map(({ value, label }) => {
              if (value === "other" && showCustom) {
                return (
                  <label
                    key="other-input"
                    className="cursor-pointer relative flex items-center"
                  >
                    <RadioGroupItem
                      value="other"
                      className="mr-2 h-5 w-5 shrink-0 flex items-center justify-center border-black/40 bg-white data-[state=checked]:text-black"
                    />
                    <Input
                      value={customTone}
                      onChange={(e) => setCustomTone(e.target.value)}
                      placeholder="Type your tone…"
                      className="w-[220px] h-11 bg-white text-black border border-black/20 rounded-[12px]"
                    />
                  </label>
                );
              }

              return (
                <label
                  key={value}
                  className="cursor-pointer relative rounded-[12px] border border-black/20 bg-[#191919] text-[#FFDB93] transition-all duration-200 px-4 h-11 flex items-center justify-start gap-3 hover:border-black/40 has-[button[data-state=checked]]:border-[#FFDB93] has-[button[data-state=checked]]:shadow-md has-[button[data-state=checked]]:shadow-black/25"
                >
                  <RadioGroupItem
                    value={value}
                    className="h-5 w-5 shrink-0 flex items-center justify-center border-[#FFDB93] data-[state=checked]:text-[#FFDB93]"
                  />
                  {value === "other" ? (
                    <>
                      <Plus size={18} strokeWidth={1.8} />
                      <span className="font-geist text-sm font-medium whitespace-nowrap">
                        Other
                      </span>
                    </>
                  ) : (
                    <span className="font-geist text-sm font-medium whitespace-nowrap">
                      {label}
                    </span>
                  )}
                </label>
              );
            })}
          </RadioGroup>

          <div className="w-full max-w-4xl flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(nextHref)}
              className="cursor-pointer h-10 px-5 rounded-[8px] border border-black text-black bg-transparent hover:bg-white transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="cursor-pointer h-10 px-6 rounded-[8px] border border-black bg-black text-white hover:bg-[#0A0A0A] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
