"use client";

import { Check } from "lucide-react";
import gsap from "gsap";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

type BillingPlan = "monthly" | "annual";

type CardConfig = {
  id: "starter" | "plus" | "power";
  title: string;
  subtitle?: string;
  monthlyPrice: number;
  annualPrice: number;
  introText?: string;
  features: string[];
};

const CARD_CONFIG: CardConfig[] = [
  {
    id: "starter",
    title: "Starter",
    subtitle: "For daily AI power users",
    monthlyPrice: 12,
    annualPrice: 10,
    introText: undefined,
    features: [
      "All AI models",
      "Basic smart routing",
      "Limited persona bots",
      "3 web searches / day",
      "Pin & save outputs",
    ],
  },
  {
    id: "plus",
    title: "Plus",
    subtitle: "For daily AI power users",
    monthlyPrice: 25,
    annualPrice: 21,
    introText: "Everything in Starter, plus",
    features: [
      "Advanced model routing to best model",
      "Unlimited personas",
      "5 shareable personas",
      "Project-based organization",
      "2 workflows",
      "Expanded web search",
    ],
  },
  {
    id: "power",
    title: "Power",
    subtitle: "Zero limits",
    monthlyPrice: 100,
    annualPrice: 83,
    introText: "Everything in Plus, and",
    features: [
      "Power routing — both algorithms unlocked",
      "Unlimited personas & sharing",
      "Unlimited workflows",
      "Max usage & priority compute",
      "Priority support",
      "API access",
    ],
  },
];

const PricingPage = () => {
  const [billing, setBilling] = useState<BillingPlan>("monthly");

  const cardsById = useMemo(() => {
    const map: Record<CardConfig["id"], CardConfig> = {
      starter: CARD_CONFIG[0],
      plus: CARD_CONFIG[1],
      power: CARD_CONFIG[2],
    };
    return map;
  }, []);

  const [displayPrices, setDisplayPrices] = useState<Record<CardConfig["id"], number>>(() => ({
    starter: cardsById.starter.monthlyPrice,
    plus: cardsById.plus.monthlyPrice,
    power: cardsById.power.monthlyPrice,
  }));

  const toggleRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const monthlyBtnRef = useRef<HTMLButtonElement | null>(null);
  const annualBtnRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const container = toggleRef.current;
    const slider = sliderRef.current;
    const monthlyBtn = monthlyBtnRef.current;
    const annualBtn = annualBtnRef.current;
    if (!container || !slider || !monthlyBtn || !annualBtn) return;

    const activeBtn = billing === "monthly" ? monthlyBtn : annualBtn;

    const x = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;

    gsap.to(slider, {
      x,
      width,
      duration: 0.35,
      ease: "power3.out",
    });
  }, [billing]);

  useLayoutEffect(() => {
    const ids: CardConfig["id"][] = ["starter", "plus", "power"];

    ids.forEach((id) => {
      const target =
        billing === "annual" ? cardsById[id].annualPrice : cardsById[id].monthlyPrice;

      const from = displayPrices[id];
      const obj = { value: from };

      gsap.to(obj, {
        value: target,
        duration: 0.45,
        ease: "power2.out",
        onUpdate: () => {
          const next = Math.round(obj.value);
          setDisplayPrices((prev) => (prev[id] === next ? prev : { ...prev, [id]: next }));
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing, cardsById]);

  return (
    <section className="w-full min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full flex flex-col items-center gap-8 py-10">
        {/* Section 1: Title + Subtext */}
        <section className="text-center space-y-3 max-w-2xl">
          <h1 className="font-besley text-3xl md:text-4xl text-black">
            You just saved your first thought
          </h1>
          <p className="font-geist text-sm md:text-base text-[#525252]">
            Choose a plan to keep building. Every conversation remembers the
            last.
          </p>
        </section>

        {/* Section 2: Monthly / Annual toggle */}
        <section className="flex justify-center">
          <div
            ref={toggleRef}
            className="relative inline-flex items-center bg-[#F5F5F5] rounded-[12px] shadow-xs p-1"
          >
            <div
              ref={sliderRef}
              className="absolute left-0 top-0 bottom-0 rounded-[8px] bg-[#171717]"
              style={{ width: "50%", transform: "translateX(0px)" }}
            />
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              ref={monthlyBtnRef}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                billing === "monthly" ? "text-white" : "text-[#171717]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              ref={annualBtnRef}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                billing === "annual" ? "text-white" : "text-[#171717]"
              }`}
            >
              Annual
            </button>
          </div>
        </section>

        {/* Section 3: Pricing Cards */}
        <section className="w-full flex items-center justify-center">
          <div className="grid grid-cols-3 gap-6">
            {CARD_CONFIG.map((card) => {
              const price = displayPrices[card.id];

              if (card.id === "starter") {
                return (
                  <article
                    key={card.id}
                    className="bg-white shadow-lg shadow-zinc-300 rounded-[16px] p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="bg-linear-to-b from-white via-white to-stone-200 shadow-md shadow-zinc-300 rounded-[12px] p-4 space-y-4 mb-2">
                        <div className="flex flex-col gap-0">
                          <span className="font-semibold text-lg tracking-tight text-[#171717]">
                            {card.title}
                          </span>
                          <span className="font-semibold tracking-tight text-sm text-[#212123]">
                            {card.subtitle}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-besley text-5xl font-semibold text-[#373D3D]">
                            ${price}
                          </span>
                          <span className="font-bold text-base text-[#373D3D]/80">
                            /mo
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 px-2">
                        {card.introText && (
                          <p className="font-geist text-xs text-[#212123]">
                            {card.introText}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {card.features.map((label) => (
                            <li key={label} className="flex items-center gap-2">
                              <span className="h-4 w-4 text-white bg-[#F26725] rounded-full flex items-center justify-center ">
                                <Check size={12} strokeWidth={3} />
                              </span>
                              <span className="text-sm text-[#171717]">
                                {label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        className="w-full cursor-pointer font-geist border border-[#171717] text-[#171717] rounded-[8px] py-2 text-sm font-medium hover:bg-[#171717] hover:text-white transition-colors"
                      >
                        Get Started
                      </button>
                    </div>
                  </article>
                );
              }

              if (card.id === "plus") {
                return (
                  <article
                    key={card.id}
                    className="bg-white shadow-lg shadow-zinc-300 rounded-[16px] p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="bg-linear-to-b from-[#D47E51]/70 via-[#ffa16f] to-[#D47E51]/70 text-black shadow-md shadow-zinc-300 rounded-[12px] p-4 space-y-4 mb-2">
                        <div className="flex flex-col gap-0">
                          <span className="font-semibold text-lg tracking-tight text-[#171717]">
                            {card.title}
                          </span>
                          <span className="font-semibold text-sm text-[#212123]">
                            {card.subtitle}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-besley text-5xl font-semibold text-black">
                            ${price}
                          </span>
                          <span className="font-bold text-base text-[#373D3D]/80">
                            /mo
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 px-2">
                        {card.introText && (
                          <p className="font-geist text-xs text-[#212123]">
                            {card.introText}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {card.features.map((label) => (
                            <li key={label} className="flex items-center gap-2">
                              <span className="h-4 w-4 text-white bg-[#F26725] rounded-full flex items-center justify-center ">
                                <Check size={12} strokeWidth={3} />
                              </span>
                              <span className="text-sm text-[#171717]">
                                {label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        className="w-full cursor-pointer font-geist bg-black text-[#F2F2F0] rounded-[8px] py-2 text-sm font-medium hover:bg-[#0A0A0A] transition-colors"
                      >
                        Get Started
                      </button>
                    </div>
                  </article>
                );
              }

              // Card 3: Power
              return (
                <article
                  key={card.id}
                  className="bg-white shadow-lg shadow-zinc-300 rounded-[16px] p-4 flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="bg-linear-to-b from-[#171717] via-[#171717] to-[#171717] text-[#F9D99C] shadow-lg rounded-[12px] p-4 space-y-4 mb-2">
                      <div className="flex flex-col gap-0">
                        <span className="font-semibold text-lg tracking-tight text-[#F9D99C]">
                          {card.title}
                        </span>
                        {card.subtitle && (
                          <span className="font-semibold text-sm text-[#F9D99C]">
                            {card.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-besley text-5xl font-semibold text-[#F9D99C]">
                          ${price}
                        </span>
                        <span className="font-bold text-base text-[#F9D99C]/62">
                          /mo
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 px-2">
                      {card.introText && (
                        <p className="font-geist text-xs text-[#212123]">
                          {card.introText}
                        </p>
                      )}
                      <ul className="space-y-2">
                        {card.features.map((label) => (
                          <li key={label} className="flex items-center gap-2">
                            <span className="h-4 w-4 text-white bg-[#F26725] rounded-full flex items-center justify-center ">
                              <Check size={12} strokeWidth={3} />
                            </span>
                            <span className="text-sm text-[#171717]">
                              {label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      className="w-full cursor-pointer font-geist bg-[#191919] text-[#F9D99C] rounded-[8px] py-2 text-sm font-medium hover:bg-black transition-colors"
                    >
                      Go Unlimited
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Section 4: Individual / Teams toggle */}
        {/* <section className="flex justify-center">
          <div className="inline-flex items-center bg-[#F5F5F5] rounded-[12px] shadow-xs p-1">
            <button
              type="button"
              onClick={() => setMode("individual")}
              className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                mode === "individual"
                  ? "bg-[#171717] text-white"
                  : "bg-white text-[#171717]"
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setMode("teams")}
              className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                mode === "teams"
                  ? "bg-[#171717] text-white"
                  : "bg-white text-[#171717]"
              }`}
            >
              Teams
            </button>
          </div>
        </section> */}
      </div>
    </section>
  );
};

export default PricingPage;
