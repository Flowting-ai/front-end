"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ThemeChoice = "light" | "dark";

export default function Page() {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeChoice>("light");

  const nextHref = useMemo(() => "/onboarding/role", []);

  return (
    <section className="w-full min-h-screen lg:h-screen p-6 bg-[#FAF9F8]">
      <div className="w-full h-full bg-linear-to-b from-blue-200 via-amber-200 to-blue-200 border border-zinc-600/40 rounded-[16px] shadow-md">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8 px-6 py-10">
          {/* Header */}
          <div className="max-w-2xl w-full text-center flex flex-col items-center gap-4">
            <Image
              src="/new-logos/souvenir-logo.svg"
              width={500}
              height={500}
              alt="Souvenir Logo"
              className="w-14 h-14"
              unoptimized
            />

            <h3 className="font-besley text-4xl text-black">Pick Your Style</h3>

            <p className="font-geist text-base md:text-lg text-[#525252]">
              Both themes are designed to reduce eye strain during long
              sessions. Pick whichever feels like you.
            </p>
          </div>

          {/* Radio Buttons */}
          <RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as ThemeChoice)}
            className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label className="cursor-pointer relative rounded-[12px] border bg-white text-black transition-all duration-200 p-5 min-h-[150px] has-[button[data-state=checked]]:border-black has-[button[data-state=checked]]:shadow-md has-[button[data-state=checked]]:shadow-black/10 border-black/20 hover:border-black/40">
              <RadioGroupItem
                value="light"
                className="absolute top-4 left-4 h-5 w-5 border-black data-[state=checked]:text-black"
              />
              <div className="space-y-1 pl-10">
                <p className="font-geist text-sm font-semibold tracking-tight">
                  Light mode
                </p>
                <p className="font-geist text-sm text-[#525252]">
                  Crisp, clean, and airy.
                </p>
              </div>
              <div className="mt-4 rounded-[10px] border border-black/10 bg-[#FAF9F8] p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="h-2 w-24 rounded bg-black/15" />
                  <div className="mt-2 h-2 w-40 rounded bg-black/10" />
                  <div className="mt-2 h-2 w-32 rounded bg-black/10" />
                </div>

                <Image
                  src="/new-logos/souvenir-logo.svg"
                  width={500}
                  height={500}
                  alt="Souvenir Logo"
                  className="w-12 h-12"
                  unoptimized
                />
              </div>
            </label>

            <label className="cursor-pointer relative rounded-[12px] border bg-black text-white transition-all duration-200 p-5 min-h-[150px] has-[button[data-state=checked]]:border-black has-[button[data-state=checked]]:shadow-md has-[button[data-state=checked]]:shadow-black/20 has-[button[data-state=checked]]:ring-1 has-[button[data-state=checked]]:ring-white/10 border-black/20 hover:border-black/40">
              <RadioGroupItem
                value="dark"
                className="absolute top-4 left-4 h-5 w-5 border-white data-[state=checked]:text-white"
              />
              <div className="space-y-1 pl-10">
                <p className="font-geist text-sm font-semibold tracking-tight">
                  Dark mode
                </p>
                <p className="font-geist text-sm text-white/70">
                  Softer contrast, late-night friendly.
                </p>
              </div>
              <div className="mt-4 rounded-[10px] border border-white/10 bg-white/5 flex items-center justify-between p-3">
                <div className="flex flex-col">
                <div className="h-2 w-24 rounded bg-white/25" />
                <div className="mt-2 h-2 w-40 rounded bg-white/15" />
                <div className="mt-2 h-2 w-32 rounded bg-white/15" />
                </div>
                <Image
                  src="/new-logos/souvenir-logo-chat.svg"
                  width={500}
                  height={500}
                  alt="Souvenir Logo"
                  className="w-12 h-12"
                  unoptimized
                />
              </div>
            </label>
          </RadioGroup>

          {/* Buttons */}
          <div className="w-full max-w-2xl flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(nextHref)}
              className="cursor-pointer h-10 px-5 rounded-[8px] border border-black text-black bg-transparent hover:bg-white transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => router.push(nextHref)}
              className="cursor-pointer h-10 px-6 rounded-[8px] border border-black bg-black text-white hover:bg-[#0A0A0A] transition-colors"
            >
              Continue
            </button>
          </div>

          <Link
            href="/api/auth/logout?returnTo=https://getsouvenir.com"
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