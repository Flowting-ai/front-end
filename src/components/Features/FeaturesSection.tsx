"use client";
import Iridescence from "@/animations/Iridescence";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    id: 1,
    title: "Chat across any model",
    description:
      "Not every AI thinks the same way. Some are better at writing. Some are better at code. Some are better at research. With Flowting, you pick the one that fits Claude, GPT, Gemini and switch anytime without losing your conversation. One chat. Many minds. You got a great answer. Now don't let it disappear.",
    image: "/features/feature1.svg",
    styling: "translate-x-12 scale-90",
  },
  {
    id: 2,
    title: "Save what feels important.",
    description:
      "You know that moment — AI gives you something perfect, and two hours later you can't find it. In Flowting, you pin it. One click. That insight, that summary, that piece of code — saved right where you found it. No more digging through old chats. Now you have the good stuff. But good stuff scattered everywhere is still a mess.",
    image: "/features/feature2.svg",
    styling: "translate-x-0 scale-90",
  },
  {
    id: 3,
    title: "Organize it your way.",
    description:
      "Group your saved work by project, by client, by idea — whatever makes sense to you. Not folders someone else designed. Not tags that don't fit. Your system. Your structure. Your AI work finally has a home.Everything is in place. Here's where it starts to pay off.",
    image: "/features/feature3.svg",
    styling: "translate-x-0 scale-90",
  },
  {
    id: 4,
    title: "Reuse context instantly",
    description:
      "New conversation? Bring your saved context in with one click. The research you already did. The decisions you already made. It's all there. No copy-paste. No starting from scratch. Every new chat picks up where the last one left off. This is where your AI stops forgetting and starts working like you do.",
    image: "/features/feature4.svg",
    styling: "translate-x-16 scale-120",
  },
];

export default function FeaturesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerTop = containerRect.top;
      const viewportCenter = window.innerHeight / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      featureRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const refRect = ref.getBoundingClientRect();
        const refCenter = refRect.top + refRect.height / 2;
        const distance = Math.abs(refCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = idx;
        }
      });

      setActiveIndex(closestIndex);
    };

    window.addEventListener("scroll", handleScroll, true);
    handleScroll(); // Call once on mount
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  return (
    <section className="w-full mt-0 lg:mt-10 mb-10 lg:mb-40" ref={containerRef}>
      <div className="max-w-7xl mx-auto text-center flex flex-col items-center gap-10 px-4 lg:px-0">
        <div className="flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[120%] text-balance text-xl lg:text-[37px] text-foreground">
              Practical Features. Measurable Impact.
            </h3>
          </div>
          <p className="font-normal text-sm lg:text-base">
            Designed for Efficiency and Reliability
          </p>
        </div>

        {/* Features Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left Column - Features */}
          <div className="w-full">
            {features.map((feature, idx) => (
              <div
                key={feature.id}
                ref={(el) => {
                  featureRefs.current[idx] = el;
                }}
                className="relative w-full h-auto lg:h-screen bg-linear-to-b from-transparent via-blue-300 via-85% to-blue-400 lg:via-transparent lg:to-transparent border-2 lg:border-0 border-white rounded-3xl shadow-sm lg:shadow-none flex flex-col justify-center gap-4 text-left p-8 lg:p-12 overflow-hidden lg:overflow-auto mb-4 last:mb-0"
              >
                <div className="-z-1 absolute top-1/2 left-1/2 -translate-1/2 w-1/2 h-1/2 bg-linear-to-b from-blue-200/30 via-blue-100/30 to-blue-200/30 blur-3xl"></div>
                <h4 className="font-normal text-xl lg:text-[28px]">{feature.title}</h4>
                <p className="text-subtext text-sm lg:text-base leading-relaxed">
                  {feature.description}
                </p>
                <div className="lg:hidden w-full h-auto flex items-center justify-center">
                  <Image
                      src={feature.image}
                      alt={feature.title}
                      width={520}
                      height={520}
                      className={`w-full h-auto max-h-162.5 object-contain ${feature.styling}`}
                    />
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - transparent container; blue background is sticky and centered with max-h 769px on desktop */}
          <div className="hidden lg:block w-full relative">
            <div
              className="mx-auto w-full max-w-lg"
              style={{
                position: "sticky",
                top: "calc((100vh - 640px) / 2)",
                maxHeight: 640,
                height: 640,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* Blue Background */}
              <div className="z-0 absolute inset-0 overflow-hidden rounded-3xl">
                <Image
                  src="./yourContext/background.svg"
                  alt="background"
                  fill
                  className="blur-[10px] w-full h-full object-contain bg-transparent backdrop-blur-[2px] rounded-3xl"
                  // bg-linear-to-br from-blue-600/30 via-blue-300/30 to-blue-500/30
                />
                <Iridescence
                  color={[0, 0.8, 1]}
                  mouseReact
                  amplitude={0.1}
                  speed={1}
                />
              </div>

              {/* images - switch based on activeIndex; they align vertically to the same area as the feature content */}
              <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
                {features.map((feature, idx) => (
                  <div
                    key={feature.id}
                    className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                    style={{
                      opacity: activeIndex === idx ? 1 : 0,
                      pointerEvents: activeIndex === idx ? "auto" : "none",
                    }}
                  >
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      width={520}
                      height={520}
                      className={`w-full h-auto max-h-162.5 object-contain ${feature.styling}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
