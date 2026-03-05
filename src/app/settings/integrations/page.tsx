"use client";

import { useState } from "react";

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";

type IntegrationStatus = "connected" | "disconnected";

interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
}

const INITIAL_INTEGRATIONS: IntegrationItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Send Flowting outputs directly into channels.",
    status: "disconnected",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Create issues and PR summaries from chats.",
    status: "disconnected",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Save notes and docs to your workspace pages.",
    status: "disconnected",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Index and reference files from shared folders.",
    status: "disconnected",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Turn tasks into tickets with full context.",
    status: "disconnected",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Sync tasks and bug reports with your roadmap.",
    status: "disconnected",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Reference designs and components in conversations.",
    status: "disconnected",
  },
];

const getInitials = (name: string) => {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

export default function SettingsIntegrationsPage() {
  const [integrations, setIntegrations] =
    useState<IntegrationItem[]>(INITIAL_INTEGRATIONS);

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status:
                item.status === "connected" ? "disconnected" : "connected",
            }
          : item
      )
    );
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Integrations</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Connect external tools to your workspace.
            </p>
          </div>

          {/* Integrations list */}
          <div className="flex flex-col gap-4 mt-1">
            {integrations.map((integration) => {
              const isConnected = integration.status === "connected";

              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] pb-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Logo placeholder */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-md border border-[#E5E5E5] bg-transparent text-[#525252] text-sm font-medium">
                      {getInitials(integration.name)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base text-[#1E1E1E]">
                        {integration.name}
                      </span>
                      <span className="text-sm text-[#757575]">
                        {integration.description}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => toggleIntegration(integration.id)}
                    className={
                      isConnected
                        ? "cursor-pointer font-geist font-medium text-sm text-white bg-[#14AE5C] hover:bg-[#149E55] rounded-[8px] px-3 py-2 h-auto"
                        : "cursor-pointer font-geist font-medium text-sm rounded-[8px] px-3 py-2 h-auto border border-input bg-transparent text-[#171717] hover:bg-accent hover:text-accent-foreground shadow-xs"
                    }
                  >
                    {isConnected ? "Connected" : "Connect"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
