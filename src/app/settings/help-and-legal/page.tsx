"use client";

import AppLayout from "@/components/layout/app-layout";
import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";

const helpLinks = [
  // {
  //   id: "help-center",
  //   title: "Help Center",
  //   description: "Optimize for cost or quality",
  //   href: "/help-center",
  // },
  {
    id: "contact-support",
    title: "Contact Support",
    description: "Reach our team via email",
    href: "https://www.getsouvenir.com/contact",
  },
  // {
  //   id: "feature-request",
  //   title: "Feature Request",
  //   description: "Suggest improvements",
  //   href: "/feature-request",
  // },
  // {
  //   id: "report-bug",
  //   title: "Report a Bug",
  //   description: "Let us know what's broken",
  //   href: "/report-bug",
  // },
];

const legalLinks = [
  {
    id: "terms",
    title: "Terms of Service",
    href: "https://www.getsouvenir.com/legal/platform-terms/terms-of-service",
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    href: "https://www.getsouvenir.com/legal/privacy-data/privacy-policy",
  },
  // {
  //   id: "dpa",
  //   title: "Data Processing Agreement",
  //   href: "/legal/data-processing-agreement",
  // },
  {
    id: "cookies",
    title: "Cookie Policy",
    href: "https://www.getsouvenir.com/legal/privacy-data/cookie-policy",
  },
];

export default function SettingsHelpAndLegalPage() {
  const thisYear = new Date().getFullYear();

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-8">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Help &amp; Legal</h1>
            <p className="font-geist text-sm text-black">
              Get support and review legal information.
            </p>
          </div>

          {/* Help links */}
          <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-4">
            {helpLinks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-1"
              >
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    {item.title}
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    {item.description}
                  </span>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex items-center justify-center"
                  aria-label={item.title}
                >
                  <SquareArrowOutUpRight className="w-5 h-5 text-[#525252]" />
                </Link>
              </div>
            ))}
          </div>

          {/* Legal section */}
          <div className="flex flex-col gap-3">
            <h2 className="font-clash text-2xl text-black">Legal</h2>
            <div className="flex flex-col gap-4">
              {legalLinks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex flex-col">
                    <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                      {item.title}
                    </span>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex items-center justify-center"
                    aria-label={item.title}
                  >
                    <SquareArrowOutUpRight className="w-5 h-5 text-[#525252]" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="font-medium text-xs text-[#757575] pt-4">
            SouvenirAI v1.0.0 &bull; &copy; {thisYear} SouvenirAI
          </div>
        </div>
      </div>
    </AppLayout>
  );
}