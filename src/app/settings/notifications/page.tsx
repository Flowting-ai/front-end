"use client";

import { useState } from "react";

import AppLayout from "@/components/layout/app-layout";
import { Switch } from "@/components/ui/switch";

type NotificationEvent =
  | "automation-complete"
  | "automation-failed"
  | "file-processed"
  | "memory-updated"
  | "budget-alert"
  | "team-invite";

interface NotificationRow {
  id: NotificationEvent;
  label: string;
}

const NOTIFICATION_ROWS: NotificationRow[] = [
  { id: "automation-complete", label: "Automation complete" },
  { id: "automation-failed", label: "Automation failed" },
  { id: "file-processed", label: "File processed" },
  { id: "memory-updated", label: "Memory updated" },
  { id: "budget-alert", label: "Budget alert" },
  { id: "team-invite", label: "Team invite" },
];

export default function SettingsNotificationsPage() {
  const [inAppSettings, setInAppSettings] = useState<Record<NotificationEvent, boolean>>({
    "automation-complete": true,
    "automation-failed": true,
    "file-processed": true,
    "memory-updated": true,
    "budget-alert": true,
    "team-invite": true,
  });

  const [emailSettings, setEmailSettings] = useState<Record<NotificationEvent, boolean>>({
    "automation-complete": false,
    "automation-failed": true,
    "file-processed": false,
    "memory-updated": false,
    "budget-alert": true,
    "team-invite": true,
  });

  const toggleInApp = (id: NotificationEvent, value: boolean) => {
    setInAppSettings((prev) => ({ ...prev, [id]: value }));
  };

  const toggleEmail = (id: NotificationEvent, value: boolean) => {
    setEmailSettings((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Notifications</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Choose which events you want to be notified about.
            </p>
          </div>

          {/* Notifications table */}
          <div className="flex flex-col gap-2">
            {/* Header row */}
            <div className="flex items-center border-b border-[#B2B2B2] pb-2 text-sm font-medium text-[#1E1E1E]">
              <div className="w-4/5">Event</div>
              <div className="w-1/10 text-center">In-app</div>
              <div className="w-1/10 text-center">Email</div>
            </div>

            {/* Data rows */}
            <div className="flex flex-col gap-2">
              {NOTIFICATION_ROWS.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center py-1 text-sm"
                >
                  <div className="w-4/5 text-base text-[#757575]">
                    {row.label}
                  </div>
                  <div className="w-1/10 flex justify-center">
                    <Switch
                      checked={inAppSettings[row.id]}
                      onCheckedChange={(checked) =>
                        toggleInApp(row.id, Boolean(checked))
                      }
                      className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                    />
                  </div>
                  <div className="w-1/10 flex justify-center">
                    <Switch
                      checked={emailSettings[row.id]}
                      onCheckedChange={(checked) =>
                        toggleEmail(row.id, Boolean(checked))
                      }
                      className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
