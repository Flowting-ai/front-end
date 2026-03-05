"use client";

import { useState } from "react";

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsMemoryAndContextPage() {
  const [rememberPinned, setRememberPinned] = useState(true);
  const [rememberPreferences, setRememberPreferences] = useState(true);
  const [rememberProjects, setRememberProjects] = useState(true);
  const [excludeSensitive, setExcludeSensitive] = useState(true);

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Memory &amp; Context</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Control what Flowting remembers across conversations.
            </p>
          </div>

          {/* Clear memory */}
          <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
            <div className="flex flex-col">
              <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                Clear all memory
              </span>
              <span className="text-sm text-[#0A0A0A]">
                Remove everything Flowting has learned about you.
              </span>
            </div>
            <Button className="cursor-pointer font-geist font-medium text-sm text-[#FFFFFF] bg-[#DC2626] hover:bg-[#B91C1C] rounded-[8px] px-3 py-2 h-auto">
              Clear Memory
            </Button>
          </div>

          {/* What gets remembered */}
          <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-4">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">What gets remembered</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Toggle categories of information FlowtingAI retains.
              </p>
            </div>

            <div className="flex flex-col gap-6 mt-3">
              {/* Pinned items */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Pinned items
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Remember content you&apos;ve explicitly pinned
                  </span>
                </div>
                <Switch
                  checked={rememberPinned}
                  onCheckedChange={(checked) => setRememberPinned(Boolean(checked))}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                />
              </div>

              {/* User preferences */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    User preferences
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Tone, formatting, and style preferences
                  </span>
                </div>
                <Switch
                  checked={rememberPreferences}
                  onCheckedChange={(checked) =>
                    setRememberPreferences(Boolean(checked))
                  }
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                />
              </div>

              {/* Project facts */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Project facts
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Product names, goals, and team details
                  </span>
                </div>
                <Switch
                  checked={rememberProjects}
                  onCheckedChange={(checked) =>
                    setRememberProjects(Boolean(checked))
                  }
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                />
              </div>

              {/* Exclude sensitive info */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Exclude sensitive info
                  </span>
                  <span className="text-sm text-[#0A0A0A]">
                    Never store passwords, tokens, or PII
                  </span>
                </div>
                <Switch
                  checked={excludeSensitive}
                  onCheckedChange={(checked) =>
                    setExcludeSensitive(Boolean(checked))
                  }
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                />
              </div>
            </div>
          </div>

          {/* Context assembly */}
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">Context assembly</h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Control how context is prioritized and sized.
              </p>
            </div>

            <div className="border border-[#B2B2B2] rounded-[10px] p-3 space-y-3">
              {/* Priority order description */}
              <div className="space-y-0.5">
                <p className="font-geist font-medium text-sm text-[#0A0A0A]">
                  Priority order
                </p>
                <p className="text-xs text-[#4B5563]">
                  Higher items take precedence when context limit is reached.
                </p>
              </div>

              {/* Priority list */}
              <div className="overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white">
                <div className="divide-y divide-[#E5E5E5]">
                  {[
                    "Pinned Items",
                    "Current Chat",
                    "Connected docs",
                    "Persona Notes",
                    "Workspace Memory",
                  ].map((label, index) => (
                    <div
                      key={label}
                      className={`grid grid-cols-[auto,1fr] items-stretch text-sm text-[#0A0A0A] ${
                        index % 2 === 1 ? "bg-[#F5F5F5]" : "bg-white"
                      }`}
                    >
                      <div className="px-3 flex items-center justify-start gap-2 border-r border-[#E5E5E5]">
                        <div className="w-10 border-r flex items-center justify-end">
                        <p className="text-sm text-[#0A0A0A] px-2 py-2">
                          {index + 1}
                        </p>
                        </div>
                        
                        <p>{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Context window size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1 text-sm text-[#1E1E1E]">
                  <span className="font-medium">Context window size</span>
                  <span className="text-[#757575]">65% • ~130K tokens</span>
                </div>

                <div className="w-full h-2 rounded-full bg-[#D4D4D4] overflow-hidden">
                  <div
                    className="h-full bg-[#0A0A0A]"
                    style={{ width: "65%" }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#757575] px-1">
                  <span>Faster</span>
                  <span>More Accurate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}