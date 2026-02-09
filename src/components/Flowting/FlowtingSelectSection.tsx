'use client';
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const AIModels = [
  { name: "Grok", id: "grok", color: "from-purple-600 to-purple-800" },
  { name: "ChatGPT", id: "chatgpt", color: "from-green-600 to-green-800" },
  { name: "Claude", id: "claude", color: "from-blue-600 to-blue-800" },
  { name: "Gemini", id: "gemini", color: "from-red-600 to-red-800" },
  { name: "Meta", id: "meta", color: "from-orange-600 to-orange-800" },
  { name: "DeepSeek", id: "deepseek", color: "from-pink-600 to-pink-800" },
  { name: "Qwen", id: "qwen", color: "from-cyan-600 to-cyan-800" },
];

const sampleQueries = [
  "Create a product mockup image",
  "Latest findings on mRNA vaccines",
  "Write a python script for this csv",
  "Debug this React component",
  "Explain quantum computing",
  "Design a database schema",
  "Summarize this research paper",
];

export default function FlowtingSelectSection() {
  const [currentQueryIdx, setCurrentQueryIdx] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    const cycleDuration = 7000; // 7 seconds per cycle

    const animationFrame = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % cycleDuration) / cycleDuration;
      const newRotation = progress * 360;
      setRotation(newRotation);

      // Update query every 7 seconds
      if (elapsed % cycleDuration < 16) {
        setCurrentQueryIdx((prev) => (prev + 1) % sampleQueries.length);
      }
    }, 16);

    return () => clearInterval(animationFrame);
  }, []);

  const currentQuery = sampleQueries[currentQueryIdx] || sampleQueries[0];
  const selectedModelIdx = currentQueryIdx % AIModels.length;
  const selectedModel = AIModels[selectedModelIdx] || AIModels[0];

  // Get previous queries for the stack
  const previousQueries = Array.from({ length: 4 }, (_, i) => {
    const idx = (currentQueryIdx - 4 + i) % sampleQueries.length;
    return { text: sampleQueries[idx], level: i }; // 0 = farthest, 3 = closest
  });

  return (
    <section className="w-full h-auto my-10 lg:my-40">
      {/* Initial Content */}
      <div className="max-w-7xl mx-auto text-left flex flex-col gap-4 px-4 lg:px-0">
        <div className="flex flex-col gap-2">
          <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px]">
            Flowting selects the best model <br /> for your question
          </h3>
          <p className="font-normal text-sm lg:text-base">
            No more guessing. No more switching. Just ask.
          </p>
        </div>
        <Image
          src="/flowtingSelect/flowtingSelect.svg"
          alt="Flowting Selection"
          width={16}
          height={16}
          className="w-full! h-auto! object-contain"
        />
      </div>

      {/* Animated Section */}
      {/* <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(40px);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.5);
          }
          50% {
            box-shadow: 0 0 0 15px rgba(255, 255, 255, 0);
          }
        }

        .input-active {
          animation: slideDown 0.6s ease-out;
        }

        .query-exit {
          animation: slideUp 0.6s ease-in;
        }

        .selected-circle {
          animation: pulse 2s infinite;
        }

        .dotted-bg {
          background-image: radial-gradient(circle, #c0c0c0 0.5px, transparent 0.5px);
          background-size: 16px 16px;
        }

        .quarter-circle-clip {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          overflow: hidden;
        }
      `}</style> */}

      <div className="hidden max-w-7xl mx-auto mt-16">
        <div className="w-full h-auto lg:h-[540px] rounded-[12px] bg-[#EEEEEE] dotted-bg overflow-hidden p-6 md:p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 h-full">
            {/* LEFT SECTION */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-4">
              {/* Query Stack - 4 Previous Queries */}
              <div className="space-y-2 mb-4">
                {previousQueries.map((query, idx) => {
                  const distance = 4 - idx; // 4, 3, 2, 1
                  const scale = 0.55 + (idx * 0.1); // 0.55, 0.65, 0.75, 0.85
                  const blur = 12 - (idx * 3); // 12, 9, 6, 3
                  const opacity = 0.3 + (idx * 0.15); // 0.3, 0.45, 0.6, 0.75

                  return (
                    <div
                      key={idx}
                      className="origin-left"
                      style={{
                        transform: `scale(${scale})`,
                        filter: `blur(${blur}px)`,
                        opacity: opacity,
                        transformOrigin: "left center",
                        marginLeft: `${20 - idx * 5}px`,
                      }}
                    >
                      <p className="text-sm font-medium text-[#666]">
                        {query.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Active Query */}
              <div className="input-active">
                <p className="text-lg md:text-xl font-semibold text-[#1a1a1a] mb-6">
                  {currentQuery}
                </p>
              </div>

              {/* Input Bar */}
              <div className="input-active relative w-full lg:w-[520px]">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-[12px] p-0.5" />
                <div className="relative bg-white rounded-[12px] px-5 py-4 flex items-center gap-4 h-16 shadow-lg">
                  <Image
                    src="/hero/FlowtingLogo.svg"
                    alt="Flowting"
                    width={24}
                    height={24}
                    className="w-6 h-6 flex-shrink-0"
                  />

                  <span className="flex-grow text-base text-[#333] font-medium truncate">
                    {currentQuery}
                  </span>

                  <ArrowRight className="w-5 h-5 flex-shrink-0 text-[#666] transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>

            {/* RIGHT SECTION - Rotating Models with Top-Right Pivot */}
            <div className="w-full lg:w-1/2 flex items-start justify-center lg:justify-end relative h-96 lg:h-[540px]">
              <div className="relative w-96 h-96">
                {/* Quarter Circle Container with Clip */}
                <div className="absolute top-0 right-0 w-96 h-96 overflow-hidden">
                  {/* Rotating AI Models - Starts from top right */}
                  <div
                    className="absolute"
                    style={{
                      right: 0,
                      top: 0,
                      width: "480px",
                      height: "480px",
                      transform: `rotate(-${rotation}deg)`,
                      transformOrigin: "top right",
                      transition: "transform 16ms linear",
                    }}
                  >
                    {AIModels.map((model, idx) => {
                      // Quarter circle: 0 to 90 degrees from top-right going down-left
                      const angle = (idx * 90) / 7; // 0 to ~90 degrees
                      const radius = 180;
                      const x = -Math.cos((angle * Math.PI) / 180) * radius;
                      const y = Math.sin((angle * Math.PI) / 180) * radius;

                      const isSelected = idx === selectedModelIdx;

                      return (
                        <div
                          key={model.id}
                          className="absolute"
                          style={{
                            right: `${-x}px`,
                            top: `${y}px`,
                            transform: "translate(50%, -50%)",
                          }}
                        >
                          {/* Circle Border */}
                          <div
                            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isSelected
                                ? "selected-circle bg-white shadow-[0_0_40px_rgba(255,255,255,0.9)]"
                                : "bg-white/30 backdrop-blur-sm"
                            }`}
                          >
                            {/* Model Icon */}
                            <div
                              className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-white text-sm transition-all duration-300 ${
                                `bg-gradient-to-br ${model.color}`
                              }`}
                            >
                              {model.name[0]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Model Label - Bottom Right */}
                <div className="absolute bottom-6 right-0 text-right">
                  <p className="text-sm md:text-base font-semibold text-[#1a1a1a]">
                    {selectedModel.name}
                  </p>
                  <p className="text-xs md:text-sm text-[#666]">
                    Best for your prompt
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
