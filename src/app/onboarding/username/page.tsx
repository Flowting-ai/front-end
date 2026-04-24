"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";

import { Input } from "@/components/ui/input";
import { updateUser } from "@/lib/api/user";

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!containerRef.current) return;

      const tl = gsap.timeline();
      tl.fromTo(
        ".username-header",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
      )
        .fromTo(
          ".username-input-shell",
          { opacity: 0, y: 12, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" },
          "-=0.25",
        )
        .fromTo(
          ".username-actions",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
          "-=0.2",
        );
    }, containerRef);

    if (inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      ctx.revert();
    };
  }, []);

  const onContinue = async () => {
    const trimmedName = name.trim();
    if (trimmedName) {
      const parts = trimmedName.split(/\s+/);
      let firstName: string | null = null;
      let lastName: string | null = null;

      if (parts.length === 1) {
        firstName = parts[0];
        lastName = null;
      } else if (parts.length === 2) {
        [firstName, lastName] = parts;
      } else {
        firstName = parts[0];
        lastName = parts[parts.length - 1];
      }

      try {
        await updateUser({
          first_name: firstName,
          last_name: lastName,
        });
      } catch (error) {
        console.error("Failed to save name during onboarding", error);
        // Intentionally continue onboarding even if this fails
      }
    }

    router.push("/onboarding/role");
  };

  return (
    <section className="w-full min-h-screen lg:h-screen p-6 bg-[#FAF9F8]">
      <div className="w-full h-full bg-linear-to-b from-blue-200 via-amber-200 to-blue-200 border border-zinc-600/40 rounded-[16px] shadow-md">
        <div
          ref={containerRef}
          className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8 px-6 py-10"
        >
          <div className="username-header max-w-2xl w-full text-center flex flex-col items-center gap-4">
            <Image
              src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/image.png"
              width={500}
              height={500}
              alt="Souvenir Logo"
              className="w-14 h-14"
              unoptimized
            />
            <h3 className="font-besley text-4xl text-black">
              Welcome to Souvenir
            </h3>
            <p className="font-geist text-base md:text-lg text-[#525252]">
              Let&apos;s start with your name so we can personalize your
              workspace.
            </p>
          </div>

          <div className="username-input-shell w-full max-w-xl space-y-3 text-center">
            <label className="block font-besley text-2xl text-[#171717]">
              What should we call you?
            </label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name…"
              className="h-12 bg-white/90 backdrop-blur-sm text-black border border-black/20 rounded-[14px] shadow-sm focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-0 text-center"
            />
          </div>

          <div className="username-actions w-full max-w-xl flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onContinue}
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

          <Link
            href="https://app.getsouvenir.com/auth/logout"
            className="inline-flex items-center gap-2 font-geist text-sm text-[#525252] hover:text-black transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Logout
          </Link>
        </div>
      </div>
    </section>
  );
}
