"use client";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../Navbar/Navbar";
import Iridescence from "@/animations/Iridescence";
import {
  ChevronDown,
  GitCompare,
  Pin,
  UserRoundPen,
  Workflow,
} from "lucide-react";
import { RiClaudeFill } from "react-icons/ri";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function HeroSection() {
  const line1Ref = useRef(null);
  const line2Ref = useRef(null);
  const line3Ref = useRef(null);
  const line4Ref = useRef(null);
  const containerRef = useRef(null);

  useGSAP(() => {
    const timeline = gsap.timeline({ repeat: -1 });

    // Line 1: Analyzing your prompt...
    timeline.fromTo(
      line1Ref.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
    );

    // Line 2: Checking Available Models... (Line 1 stays visible)
    timeline.fromTo(
      line2Ref.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      "+=0.3"
    );

    // Line 3: Selecting Claude... (Lines 1 & 2 stay visible)
    timeline.fromTo(
      line3Ref.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      "+=0.3"
    );

    // Line 4: Generating best response... (All visible)
    timeline.fromTo(
      line4Ref.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      "+=0.3"
    );

    // Hold all visible for a moment
    timeline.to(
      [line1Ref.current, line2Ref.current, line3Ref.current, line4Ref.current],
      { opacity: 1, duration: 1 },
      "+=0"
    );

    // All disappear together
    timeline.to(
      [line1Ref.current, line2Ref.current, line3Ref.current, line4Ref.current],
      { opacity: 0, duration: 0.5, ease: "power2.in" }
    );

    // Pause before loop
    timeline.to({}, { duration: 0.5 });
  }, { scope: containerRef });
  return (
    <section className="w-full min-h-screen">
      {/* === NAVBAR === */}
      <div className="max-w-7xl mx-auto flex items-center justify-center px-2 lg:px-0 py-3 lg:py-6">
        <Navbar />
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-4 px-4 lg:px-0">
        {/* Title + Small Descriptions */}
        <div className="flex flex-col gap-3 lg:gap-2">
          <p className="font-normal text-sm lg:text-base text-foreground">
            Elevate your work.
          </p>
          <h1 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
            Do your best work with FlowtingAI.
            <br />
            The new home for AI practitioners
          </h1>
          <p className="font-normal text-sm lg:text-base text-foreground">
            Turn scattered AI chats into focused workflows
          </p>
        </div>

        {/* Content */}
        <div className="relative w-full h-auto min-h-114.75 lg:min-h-149.5 flex items-center justify-center">
          <div className="z-0 absolute inset-0 overflow-hidden rounded-2xl lg:rounded-3xl flex items-center justify-center">
            {/* Flowting Content */}
            <div className="z-3 absolute top-2 lg:top-30.5 w-[95%] xl:w-252 xl:h-234 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="relative w-full h-full flex">
                {/* Left Sidebar */}
                <div className="hidden w-16 h-full bg-app-bg border-r border-app-border lg:flex flex-col px-3">
                  {/* Logo */}
                  <div className="w-full h-auto min-h-14 border-b border-app-border flex items-center justify-center">
                    <Image
                      src="./hero/FlowtingLogoBlue.svg"
                      alt="Flowting Logo Blue"
                      width={28}
                      height={28}
                      className="w-7 h-7 object-contain"
                    />
                  </div>

                  {/* Icons */}
                  <div className="w-full h-full flex flex-col items-center gap-3 mt-5">
                    <button className="w-10 h-10 text-black! bg-white border border-zinc-600 rounded-[18px] flex items-center justify-center">
                      <Image
                        src="./hero/notebook-pen-black.svg"
                        alt="notebook-pen"
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    </button>
                    <button className="w-10 h-10 text-black! bg-white border border-app-border rounded-[18px] flex items-center justify-center">
                      <UserRoundPen size={16} strokeWidth={2} />
                    </button>
                    <button className="w-10 h-10 text-black! bg-white border border-app-border rounded-[18px] flex items-center justify-center">
                      <Workflow size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  {/* Topbar */}
                  <div className="w-full h-14 border-b border-app-border flex items-center px-4">
                    <button className="animate-dual-beam animate-border-rotate bg-app-bg! border-2! border-transparent rounded-lg shadow-sm flex items-center gap-2 px-3 py-1.5">
                      <Image
                        src="./hero/FlowtingLogo.svg"
                        alt="Flowting Logo"
                        width={20}
                        height={20}
                        className="w-4 h-4 lg:w-5 lg:h-5 object-contain"
                      />
                      <span className="text-sm lg:text-base">
                        Flowting AI Framework
                      </span>
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  <div className="flex-1 flex">
                    {/* Chat Interface */}
                    <div className="flex-1 flex flex-col gap-4 my-6">
                      <div className="w-full h-auto flex items-center justify-end px-2 lg:px-6">
                        <p className="w-full lg:max-w-1/2 text-xs text-black lg:text-sm border border-app-border rounded-tr-sm rounded-tl-2xl rounded-b-2xl px-4 py-2">
                          Analyze this react code for stale closures, shallow comparison issues, or improper hook usage. Then, provide the fix and explain the architectural reason why this happened so I can prevent it elsewhere.
                        </p>
                      </div>
                      <div className="w-full h-auto flex flex-row lg:flex-row items-start justify-start gap-0 px-2 lg:px-6">
                        <Image
                          src="./hero/FlowtingBox.svg"
                          alt="Flowting Avatar"
                          width={20}
                          height={20}
                          className="w-8 h-8 lg:w-12 lg:h-12 object-contain"
                        />

                        {/* Output Container */}
                        <div
                          ref={containerRef}
                          className="text-xs lg:text-sm text-zinc-400 flex flex-col gap-2 px-2 min-h-52"
                        >
                          <p
                            ref={line1Ref}
                            className="w-full h-10 font-mono tracking-tight font-medium bg-zinc-100 border-0 border-blue-300 rounded-xl flex items-center justify-start gap-2 px-4 opacity-0"
                          >
                            Analyzing your prompt...
                          </p>

                          <p
                            ref={line2Ref}
                            className="w-full h-10 font-mono tracking-tight font-medium bg-zinc-100 border-0 border-blue-300 rounded-xl flex items-center justify-start gap-2 px-4 opacity-0"
                          >
                            Checking Available Models...
                          </p>

                          <div
                            ref={line3Ref}
                            className="w-full h-auto lg:h-10 font-mono tracking-tight font-medium bg-zinc-100 border-0 border-blue-300 rounded-xl flex items-center justify-start gap-2 px-4 py-2 opacity-0"
                          >
                            <p className="flex flex-col lg:flex-row items-start lg:items-center gap-1 lg:gap-2">
                              Selecting{" "}
                              <span className="font-geist tracking-normal text-zinc-100 bg-zinc-900 rounded-lg flex items-center justify-center gap-1 px-2 py-1">
                                <RiClaudeFill className="text-[#D97757]" />
                                Claude Sonnet 4.5
                              </span>{" "}
                              for Deep Analysis
                            </p>
                          </div>

                          <div
                            ref={line4Ref}
                            className="w-auto h-10 tracking-normal text-foreground border border-main-border rounded-tl-sm rounded-tr-2xl rounded-b-2xl flex items-center px-4 opacity-0"
                          >
                            Generating best response. . .
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="hidden w-16 h-full border-l border-app-border lg:flex flex-col px-1">
                      {/* Icons */}
                      <div className="w-full h-full flex flex-col items-center gap-3 mt-3">
                        <button className="w-full h-16 bg-transparent border-0 border-app-border rounded-xl flex flex-col items-center justify-center gap-1">
                          <Pin size={24} strokeWidth={1.4} className="text-black" />
                          <p className="font-semibold text-[10px] leading-[120%] text-black">
                            Pin
                          </p>
                        </button>
                        <button className="w-full h-16 bg-transparent border-0 border-main-border rounded-xl flex flex-col items-center justify-center gap-1">
                          <GitCompare size={24} strokeWidth={1.4} className="text-black" />
                          <p className="font-semibold text-[10px] leading-[120%] text-black">
                            Compare <br />
                            Models
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Blur Glass */}
            <div className="z-2 absolute inset-0 backdrop-blur-[5px]"></div>

            {/* Animated BG */}
            <Iridescence
              color={[0, 0.8, 1]}
              mouseReact
              amplitude={0.1}
              speed={1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
