"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  suffix?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  padding?: "md" | "lg";
  shadow?: "sm" | "md" | "lg";
  radius?: "md" | "lg";
  hoverable?: boolean;
}

const paddingMap: Record<NonNullable<StatCardProps["padding"]>, string> = {
  md: "!p-4",
  lg: "!p-6",
};

const shadowMap: Record<NonNullable<StatCardProps["shadow"]>, string> = {
  sm: "shadow-[0_6px_12px_rgba(15,23,42,0.08)]",
  md: "shadow-[0_8px_15px_rgba(0,0,0,0.05)]",
  lg: "shadow-[0_12px_24px_rgba(15,23,42,0.12)]",
};

const radiusMap: Record<NonNullable<StatCardProps["radius"]>, string> = {
  md: "!rounded-[12px]",
  lg: "!rounded-[16px]",
};

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      suffix,
      change,
      trend = "neutral",
      icon,
      padding = "lg",
      shadow = "md",
      radius = "lg",
      hoverable = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
    const trendColor =
      trend === "up"
        ? "text-[var(--colors-success-600,#16a34a)]"
        : trend === "down"
        ? "text-[var(--colors-danger-600,#dc2626)]"
        : "text-[var(--colors-gray-500,#6b7280)]";

    const showDefaultContent = !children;

    return (
      <Card
        ref={ref}
        className={cn(
          "flex h-full flex-col justify-between gap-3 border border-[var(--general-border,#e5e5e5)] bg-[var(--general-input,#ffffff)] text-[var(--colors-gray-900,#0f172a)] transition-all duration-200",
          shadowMap[shadow],
          radiusMap[radius],
          paddingMap[padding],
          hoverable &&
            "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)]",
          className
        )}
        {...props}
      >
        {showDefaultContent ? (
          <div className="flex h-full flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <p className="text-base font-semibold tracking-tight text-[var(--colors-gray-900,#0f172a)]">
                  {title}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-[32px] font-normal leading-[38.4px] text-[var(--colors-gray-900,#0f172a)]">
                    {value}
                  </p>
                  {suffix && (
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--colors-gray-500,#6b7280)]">
                      {suffix}
                    </span>
                  )}
                </div>
                {change && (
                  <div className={cn("flex items-center gap-1 text-sm font-medium", trendColor)}>
                    <TrendIcon className="h-4 w-4" />
                    <span>{change}</span>
                  </div>
                )}
              </div>
              {icon && (
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[var(--general-border,#e5e5e5)] bg-white text-[var(--colors-gray-500,#6b7280)]">
                  {icon}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col justify-center gap-4">
            {children}
          </div>
        )}
      </Card>
    );
  }
);

StatCard.displayName = "StatCard";
