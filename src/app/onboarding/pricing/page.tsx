"use client";

import { Check, Loader2 } from "lucide-react";
import gsap from "gsap";
import { useRouter } from "next/navigation";
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";

type BillingPlan = "monthly" | "annual";

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
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuth();
  const [billing, setBilling] = useState<BillingPlan>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<CardConfig["id"] | null>(null);

  const onSelectPlan = useCallback(
    async (planId: CardConfig["id"]) => {
      if (!isHydrated) return;

      if (!isAuthenticated) {
        router.push("/auth/login");
        return;
      }

      setLoadingPlan(planId);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planId, billing }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/auth/login");
            return;
          }
          throw new Error(data.error || "Checkout failed");
        }

        if (data.url) {
          window.location.href = data.url;
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setLoadingPlan(null);
      }
    },
    [isAuthenticated, isHydrated, billing, router],
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
    const ids: CardConfig["id"][] = ["starter", "pro", "power"];

    ids.forEach((id) => {
      const target =
        billing === "annual"
          ? cardsById[id].annualPrice
          : cardsById[id].monthlyPrice;

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
  }, [billing, cardsById]);

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

        {/* Section 2: Monthly / Annual toggle */}
        <section className="font-geist flex justify-center">
          <div
            ref={toggleRef}
            className="relative inline-flex items-center bg-white rounded-[12px] shadow-md px-1 py-1.5"
          >
            <div
              ref={sliderRef}
              className="absolute left-0 top-0 bottom-0 rounded-[8px] bg-[#171717] my-1.5"
              style={{ width: "50%", transform: "translateX(0px)" }}
            />
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              ref={monthlyBtnRef}
              className={`cursor-pointer relative z-10 px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                billing === "monthly" ? "text-white" : "text-[#171717]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              ref={annualBtnRef}
              className={`cursor-pointer relative z-10 px-4 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                billing === "annual" ? "text-white" : "text-[#171717]"
              }`}
            >
              Annual
            </button>
          </div>
        </section>

        {/* Section 3: Pricing Cards */}
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
      </div>
    </section>
  );
};

export default PricingPage;
