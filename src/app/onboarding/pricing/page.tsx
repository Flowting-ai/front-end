"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  createCheckoutSession,
  type UserPlanType,
} from "@/lib/api/user";

export type CardConfig = {
  id: "starter" | "pro" | "power";
  title: string;
  subtitle?: string;
  monthlyPrice: number;
  annualPrice: number;
  introText?: string;
  features: string[];
};

export const CARD_CONFIG: CardConfig[] = [
  {
    id: "starter",
    title: "Starter",
    subtitle: "For daily AI power users",
    monthlyPrice: 12,
    annualPrice: 10,
    introText: "Plan Inclusions",
    features: [
      "Basic Usage",
      "Basic AI models",
      "Smart routing (basic algorithm)",
      "Manual model switching",
      "3 custom personas",
      "100 Pins to save outputs",
      "10 web searches / day",
      "Cross-model memory(light)",
      "Community Support",
    ],
  },
  {
    id: "pro",
    title: "Pro",
    subtitle: "For daily AI power users",
    monthlyPrice: 25,
    annualPrice: 21,
    introText: "Everything in Starter, plus",
    features: [
      "More Usage*",
      "Basic + Advanced AI Models",
      "Basic + Advanced routing algorithm",
      "Model Compare(side-by-side)",
      "2000 Pins",
      "Unlimited Personas + 2 shared",
      "Unlimited Web Search",
      "Model compare",
      "Persona & Workflow Analytics",
      "Early access to new features",
      "Email & chat support",
    ],
  },
  {
    id: "power",
    title: "Power",
    subtitle: "Zero limits",
    monthlyPrice: 100,
    annualPrice: 83,
    introText: "Everything in Pro, plus",
    features: [
      "5x usage*",
      "All models : Basic + Advanced",
      "All algorithms + manual switch",
      "Unlimited Pins & Personas",
      "Unlimited workflows + sharing",
      "Advanced Analytics",
      "Priority compute",
      "First access to new features",
      "Priority support + live response",
    ],
  },
];

const PricingPage = () => {
  const [loadingPlan, setLoadingPlan] = useState<CardConfig["id"] | null>(null);

  const toApiPlanType = (planId: CardConfig["id"]): UserPlanType => {
    if (planId === "starter") return "starter";
    if (planId === "pro") return "pro";
    return "power";
  };

  const onSelectPlan = useCallback(
    async (planId: CardConfig["id"]) => {
      setLoadingPlan(planId);
      try {
        const selectedPlan = toApiPlanType(planId);

        const checkout = await createCheckoutSession(selectedPlan, "monthly");
        window.location.href = checkout.checkout_url;
      } catch (err) {
        console.error("Checkout error:", err);
        alert(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setLoadingPlan(null);
      }
    },
    [],
  );

  const cardsById = useMemo(() => {
    const map: Record<CardConfig["id"], CardConfig> = {
      starter: CARD_CONFIG[0],
      pro: CARD_CONFIG[1],
      power: CARD_CONFIG[2],
    };
    return map;
  }, []);

  const [displayPrices, setDisplayPrices] = useState<
    Record<CardConfig["id"], number>
  >(() => ({
    starter: cardsById.starter.monthlyPrice,
    pro: cardsById.pro.monthlyPrice,
    power: cardsById.power.monthlyPrice,
  }));

  useLayoutEffect(() => {
    const ids: CardConfig["id"][] = ["starter", "pro", "power"];

    ids.forEach((id) => {
      const target = cardsById[id].monthlyPrice;
      const from = displayPrices[id];
      const obj = { value: from };

      gsap.to(obj, {
        value: target,
        duration: 0.45,
        ease: "power2.out",
        onUpdate: () => {
          const next = Math.round(obj.value);
          setDisplayPrices((prev) =>
            prev[id] === next ? prev : { ...prev, [id]: next },
          );
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsById]);

  return (
    <section className="w-full h-auto bg-[#FAF9F8] flex items-center justify-center px-4 mb-10 lg:mb-20">
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

        {/* Section 2: Pricing Cards */}
        <section className="w-full flex items-center justify-center">
          <div className="lg:min-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CARD_CONFIG.map((card) => {
              const price = displayPrices[card.id];

              // Card 1: Starter
              if (card.id === "starter") {
                return (
                  <article
                    key={card.id}
                    className="bg-white font-geist shadow-lg shadow-zinc-300 rounded-[16px] p-4 flex flex-col justify-between gap-4 lg:mt-8 lg:mb-1"
                  >
                    {/* Mini Card + Content List */}
                    <div className="flex flex-col gap-2 mb-6">
                      <div className="bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px] p-4 space-y-4 mb-2">
                        <div className="flex flex-col gap-0">
                          <span className="font-semibold text-xl tracking-tight text-[#171717]">
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

                    {/* Pay with Stripe Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onSelectPlan(card.id)}
                        disabled={loadingPlan === card.id}
                        className="flex items-center justify-center w-full cursor-pointer border border-[#171717] text-[#171717] rounded-[8px] py-2 text-sm font-medium hover:bg-[#171717] hover:text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {loadingPlan === card.id ? (
                          <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting…</>
                        ) : (
                          "Pay with Stripe"
                        )}
                      </button>
                    </div>
                  </article>
                );
              }

              // Card 2: Pro
              if (card.id === "pro") {
                return (
                  <article
                    key={card.id}
                    className="font-geist bg-linear-to-b from-[#BA9671] to-[#D3AA80] rounded-t-[16px] rounded-b-[20px] shadow-lg shadow-zinc-300 px-1 pb-1"
                  >
                    <p className="text-center font-semibold text-xs text-white py-2">
                      Most recommended
                    </p>
                    <div className="bg-white rounded-[16px] p-4 flex flex-col justify-between gap-4">
                      {/* Mini Card + Content List */}
                      <div className="flex flex-col gap-2 mb-6">
                        <div className="bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px] p-4 space-y-4 mb-2">
                          <div className="flex flex-col gap-0">
                            <span className="font-semibold text-xl tracking-tight text-black">
                              {card.title}
                            </span>
                            <span className="font-semibold tracking-tight text-sm text-[#212123]">
                              {card.subtitle}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-besley font-bold text-5xl text-black">
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
                              <li
                                key={label}
                                className="flex items-center gap-2"
                              >
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

                      {/* Pay with Stripe Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => onSelectPlan(card.id)}
                          disabled={loadingPlan === card.id}
                          className="flex items-center justify-center w-full cursor-pointer bg-black text-[#F2F2F0] rounded-[8px] py-2 text-sm font-medium hover:bg-[#0A0A0A] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {loadingPlan === card.id ? (
                            <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting…</>
                          ) : (
                            "Pay with Stripe"
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }

              // Card 3: Power
              return (
                <article
                  key={card.id}
                  className="font-geist bg-white shadow-lg shadow-zinc-300 rounded-[16px] p-4 flex flex-col justify-between gap-4 lg:mt-8 lg:mb-1"
                >
                  {/* Mini Card + Content List */}
                  <div className="flex flex-col gap-2 mb-6">
                    <div className="bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px] p-4 space-y-4 mb-2">
                      <div className="flex flex-col gap-0">
                        <span className="font-semibold text-xl tracking-tight text-black">
                          {card.title}
                        </span>
                        <span className="font-semibold tracking-tight text-sm text-[#212123]">
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

                  {/* Pay with Stripe Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onSelectPlan(card.id)}
                      disabled={loadingPlan === card.id}
                      className="flex items-center justify-center w-full cursor-pointer bg-black text-[#F2F2F0] rounded-[8px] py-2 text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loadingPlan === card.id ? (
                        <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting…</>
                      ) : (
                        "Pay with Stripe"
                      )}
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

        <a
          href="https://getsouvenir.com/"
          className="inline-flex items-center gap-2 font-geist text-sm text-[#525252] hover:text-black transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Log out &amp; return to website
        </a>
      </div>
    </section>
  );
};

export default PricingPage;
