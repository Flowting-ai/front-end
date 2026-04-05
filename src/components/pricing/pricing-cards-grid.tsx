"use client";

import { Check, Loader2 } from "lucide-react";
import gsap from "gsap";
import React, { useLayoutEffect, useMemo, useState } from "react";
import type { UserPlanType } from "@/lib/api/user";
import {
  CARD_CONFIG,
  type PricingCardId,
  getPlanChangeButtonState,
} from "@/lib/pricing-cards-config";
import { cn } from "@/lib/utils";

export type PricingCardsVariant = "onboarding" | "settings";

export type PricingCardsDensity = "default" | "fullPage";

export interface PricingCardsGridProps {
  variant: PricingCardsVariant;
  /** Current subscription plan; null if none (e.g. new subscriber from billing). */
  currentPlan: UserPlanType | null;
  loadingPlan: PricingCardId | null;
  onSelectPlan: (planId: PricingCardId) => void;
  /** Settings only: opens confirmation to cancel at period end (Stripe). */
  onCancelSubscription?: () => void;
  isCancelingSubscription?: boolean;
  /** From GET /users/me — subscription already set to end at current period. */
  subscriptionCancelAtPeriodEnd?: boolean;
  /** Larger layout that grows to fill the viewport (standalone change-plan page). */
  density?: PricingCardsDensity;
}

export function PricingCardsGrid({
  variant,
  currentPlan,
  loadingPlan,
  onSelectPlan,
  onCancelSubscription,
  isCancelingSubscription = false,
  subscriptionCancelAtPeriodEnd = false,
  density = "default",
}: PricingCardsGridProps) {
  const full = density === "fullPage";
  const cardsById = useMemo(() => {
    const map: Record<PricingCardId, (typeof CARD_CONFIG)[number]> = {
      starter: CARD_CONFIG[0],
      pro: CARD_CONFIG[1],
      power: CARD_CONFIG[2],
    };
    return map;
  }, []);

  const [displayPrices, setDisplayPrices] = useState<
    Record<PricingCardId, number>
  >(() => ({
    starter: cardsById.starter.monthlyPrice,
    pro: cardsById.pro.monthlyPrice,
    power: cardsById.power.monthlyPrice,
  }));

  useLayoutEffect(() => {
    const ids: PricingCardId[] = ["starter", "pro", "power"];

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

  const buttonFor = (cardId: PricingCardId) => {
    if (variant === "onboarding") {
      return {
        label: "Pay with Stripe" as const,
        disabled: false,
        action: "purchase" as const,
      };
    }
    return getPlanChangeButtonState(currentPlan, cardId, {
      subscriptionCancelAtPeriodEnd,
    });
  };

  return (
    <section
      className={cn(
        "w-full flex",
        full ? "min-h-0 flex-1 items-stretch" : "items-center justify-center",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-3",
          full
            ? "h-full min-h-0 w-full max-w-[1920px] mx-auto auto-rows-fr gap-4 md:gap-6 xl:gap-10 2xl:gap-12"
            : "lg:min-w-6xl gap-6",
        )}
      >
        {CARD_CONFIG.map((card) => {
          const price = displayPrices[card.id];
          const { label, disabled, action } = buttonFor(card.id);
          const isCancelAction = action === "cancel_subscription";
          const busyCheckout = loadingPlan !== null;
          const isLoadingCheckout = loadingPlan === card.id;
          const isLoadingCancel =
            isCancelAction && isCancelingSubscription;
          const footerDisabled = isCancelAction
            ? isLoadingCancel || busyCheckout
            : disabled ||
              isLoadingCheckout ||
              busyCheckout ||
              isCancelingSubscription;

          const handleFooterClick = () => {
            if (isCancelAction) {
              onCancelSubscription?.();
              return;
            }
            onSelectPlan(card.id);
          };

          const titleCls = full
            ? "font-semibold text-xl md:text-2xl xl:text-3xl tracking-tight"
            : "font-semibold text-xl tracking-tight";
          const subtitleCls = full
            ? "font-semibold tracking-tight text-sm md:text-base text-[#212123]"
            : "font-semibold tracking-tight text-sm text-[#212123]";
          const priceMainCls = full
            ? "font-besley font-semibold text-[#373D3D] text-5xl md:text-6xl xl:text-7xl"
            : "font-besley text-5xl font-semibold text-[#373D3D]";
          const priceProCls = full
            ? "font-besley font-bold text-black text-5xl md:text-6xl xl:text-7xl"
            : "font-besley font-bold text-5xl text-black";
          const pricePowerCls = full
            ? "font-besley font-semibold text-black text-5xl md:text-6xl xl:text-7xl"
            : "font-besley text-5xl font-semibold text-black";
          const miniPad = full ? "p-4 md:p-5 xl:p-6 space-y-4 mb-2" : "p-4 space-y-4 mb-2";
          const featText = full ? "text-sm md:text-[15px] text-[#171717]" : "text-sm text-[#171717]";
          const introTextCls = full
            ? "font-geist text-xs md:text-sm text-[#212123]"
            : "font-geist text-xs text-[#212123]";
          const btnOutline = full
            ? "rounded-xl py-3 md:py-3.5 text-sm md:text-base"
            : "rounded-[8px] py-2 text-sm";
          const btnSolid = full
            ? "rounded-xl py-3 md:py-3.5 text-sm md:text-base"
            : "rounded-[8px] py-2 text-sm";

          // Card 1: Starter
          if (card.id === "starter") {
            return (
              <article
                key={card.id}
                className={cn(
                  "bg-white font-geist shadow-lg shadow-zinc-300 rounded-[16px] flex flex-col justify-between gap-4",
                  full
                    ? "h-full min-h-0 p-5 md:p-7 xl:p-8 rounded-2xl shadow-xl shadow-zinc-300/30 border border-zinc-100/90"
                    : "p-4 lg:mt-8 lg:mb-1",
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col gap-2 mb-2 md:mb-4">
                  <div
                    className={cn(
                      "bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px]",
                      miniPad,
                    )}
                  >
                    <div className="flex flex-col gap-0">
                      <span className={cn(titleCls, "text-[#171717]")}>
                        {card.title}
                      </span>
                      <span className={subtitleCls}>{card.subtitle}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={priceMainCls}>${price}</span>
                      <span
                        className={cn(
                          "font-bold text-[#373D3D]/80",
                          full ? "text-lg md:text-xl" : "text-base",
                        )}
                      >
                        /mo
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "min-h-0 flex-1 space-y-3 px-1 md:px-2 overflow-y-auto",
                      full && "max-h-[38vh] lg:max-h-none",
                    )}
                  >
                    {card.introText && (
                      <p className={introTextCls}>{card.introText}</p>
                    )}
                    <ul className="space-y-2 md:space-y-2.5">
                      {card.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <span
                            className={cn(
                              "shrink-0 text-white bg-[#F26725] rounded-full flex items-center justify-center",
                              full ? "h-5 w-5" : "h-4 w-4",
                            )}
                          >
                            <Check size={full ? 14 : 12} strokeWidth={3} />
                          </span>
                          <span className={featText}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleFooterClick}
                    disabled={footerDisabled}
                    className={cn(
                      "flex items-center justify-center w-full cursor-pointer font-medium transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed",
                      btnOutline,
                      isCancelAction
                        ? "border-red-400 text-red-800 hover:bg-red-50 hover:border-red-500 hover:text-red-900"
                        : "border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white",
                    )}
                  >
                    {isLoadingCheckout || isLoadingCancel ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />{" "}
                        {isCancelAction ? "Canceling…" : "Redirecting…"}
                      </>
                    ) : (
                      label
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
                className={cn(
                  "font-geist bg-linear-to-b from-[#BA9671] to-[#D3AA80] shadow-lg shadow-zinc-300 flex flex-col",
                  full
                    ? "h-full min-h-0 rounded-2xl p-1.5 md:p-2 shadow-xl"
                    : "rounded-t-[16px] rounded-b-[20px] px-1 pb-1",
                )}
              >
                <p
                  className={cn(
                    "text-center font-semibold text-white shrink-0",
                    full ? "text-xs md:text-sm py-2 md:py-2.5" : "text-xs py-2",
                  )}
                >
                  Most recommended
                </p>
                <div
                  className={cn(
                    "bg-white flex flex-col justify-between gap-4 flex-1 min-h-0",
                    full ? "rounded-xl md:rounded-2xl p-4 md:p-6 xl:p-7" : "rounded-[16px] p-4",
                  )}
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-2 mb-2 md:mb-4">
                    <div
                      className={cn(
                        "bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px]",
                        miniPad,
                      )}
                    >
                      <div className="flex flex-col gap-0">
                        <span className={cn(titleCls, "text-black")}>
                          {card.title}
                        </span>
                        <span className={subtitleCls}>{card.subtitle}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={priceProCls}>${price}</span>
                        <span
                          className={cn(
                            "font-bold text-[#373D3D]/80",
                            full ? "text-lg md:text-xl" : "text-base",
                          )}
                        >
                          /mo
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "min-h-0 flex-1 space-y-3 px-1 md:px-2 overflow-y-auto",
                        full && "max-h-[38vh] lg:max-h-none",
                      )}
                    >
                      {card.introText && (
                        <p className={introTextCls}>{card.introText}</p>
                      )}
                      <ul className="space-y-2 md:space-y-2.5">
                        {card.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2"
                          >
                            <span
                              className={cn(
                                "shrink-0 text-white bg-[#F26725] rounded-full flex items-center justify-center",
                                full ? "h-5 w-5" : "h-4 w-4",
                              )}
                            >
                              <Check size={full ? 14 : 12} strokeWidth={3} />
                            </span>
                            <span className={featText}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleFooterClick}
                      disabled={footerDisabled}
                      className={cn(
                        "flex items-center justify-center w-full cursor-pointer font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                        btnSolid,
                        isCancelAction
                          ? "bg-[#B91C1C] text-white hover:bg-[#991B1B]"
                          : "bg-black text-[#F2F2F0] hover:bg-[#0A0A0A]",
                      )}
                    >
                      {isLoadingCheckout || isLoadingCancel ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" />{" "}
                          {isCancelAction ? "Canceling…" : "Redirecting…"}
                        </>
                      ) : (
                        label
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
              className={cn(
                "font-geist bg-white shadow-lg shadow-zinc-300 rounded-[16px] flex flex-col justify-between gap-4",
                full
                  ? "h-full min-h-0 p-5 md:p-7 xl:p-8 rounded-2xl shadow-xl shadow-zinc-300/30 border border-zinc-100/90"
                  : "p-4 lg:mt-8 lg:mb-1",
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-2 mb-2 md:mb-4">
                <div
                  className={cn(
                    "bg-linear-to-b from-white via-white to-stone-100 shadow-md shadow-zinc-300 rounded-[12px]",
                    miniPad,
                  )}
                >
                  <div className="flex flex-col gap-0">
                    <span className={cn(titleCls, "text-black")}>
                      {card.title}
                    </span>
                    <span className={subtitleCls}>{card.subtitle}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={pricePowerCls}>${price}</span>
                    <span
                      className={cn(
                        "font-bold text-[#373D3D]/80",
                        full ? "text-lg md:text-xl" : "text-base",
                      )}
                    >
                      /mo
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    "min-h-0 flex-1 space-y-3 px-1 md:px-2 overflow-y-auto",
                    full && "max-h-[38vh] lg:max-h-none",
                  )}
                >
                  {card.introText && (
                    <p className={introTextCls}>{card.introText}</p>
                  )}
                  <ul className="space-y-2 md:space-y-2.5">
                    {card.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "shrink-0 text-white bg-[#F26725] rounded-full flex items-center justify-center",
                            full ? "h-5 w-5" : "h-4 w-4",
                          )}
                        >
                          <Check size={full ? 14 : 12} strokeWidth={3} />
                        </span>
                        <span className={featText}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 shrink-0">
                <button
                  type="button"
                  onClick={handleFooterClick}
                  disabled={footerDisabled}
                  className={cn(
                    "flex items-center justify-center w-full cursor-pointer font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    btnSolid,
                    isCancelAction
                      ? "bg-[#B91C1C] text-white hover:bg-[#991B1B]"
                      : "bg-black text-[#F2F2F0] hover:bg-[#0A0A0A]",
                  )}
                >
                  {isLoadingCheckout || isLoadingCancel ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />{" "}
                      {isCancelAction ? "Canceling…" : "Redirecting…"}
                    </>
                  ) : (
                    label
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
