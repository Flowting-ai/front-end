"use client";

import { useState } from "react";

import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";

type DeviceSession = {
  id: string;
  name: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
};

const PLACEHOLDER_SESSIONS: DeviceSession[] = [
  {
    id: "current-mac",
    name: "MacBook Pro",
    location: "San Francisco, US",
    lastActive: "Now",
    isCurrent: true,
  },
  {
    id: "office-imac",
    name: "iMac (Office)",
    location: "San Francisco, US",
    lastActive: "2 hours ago",
    isCurrent: false,
  },
  {
    id: "iphone",
    name: "iPhone 15",
    location: "San Jose, US",
    lastActive: "Yesterday",
    isCurrent: false,
  },
  {
    id: "windows-laptop",
    name: "Windows Laptop",
    location: "New York, US",
    lastActive: "3 days ago",
    isCurrent: false,
  },
];

export default function SettingsSecurityPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>(PLACEHOLDER_SESSIONS);

  const handleToggleTwoFactor = () => {
    setTwoFactorEnabled((prev) => !prev);
  };

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
  };

  const handleLogoutOthers = () => {
    setSessions((prev) => prev.filter((session) => session.isCurrent));
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Security</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Protect your account and manage access.
            </p>
          </div>

          {/* Account security settings */}
          <div className="flex flex-col gap-6 border-b border-[#E5E5E5] pb-5">
            {/* Two-factor authentication */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                  Two-factor authentication
                </span>
                <span className="text-sm text-[#0A0A0A]">
                  Add an extra layer of security to your account
                </span>
              </div>
              <Button
                type="button"
                onClick={handleToggleTwoFactor}
                className={
                  twoFactorEnabled
                    ? "cursor-pointer font-geist font-medium text-sm text-[#FAFAFA] bg-[#171717] hover:bg-black rounded-[8px] px-3 py-2 h-auto"
                    : "cursor-pointer font-geist font-medium text-sm rounded-[8px] px-3 py-2 h-auto border border-input bg-transparent text-[#171717] hover:bg-accent hover:text-accent-foreground shadow-xs"
                }
              >
                {twoFactorEnabled ? "Enabled" : "Enable"}
              </Button>
            </div>

            {/* Change password */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                  Change password
                </span>
                <span className="text-sm text-[#0A0A0A]">
                  Last changed 45 days ago
                </span>
              </div>
              <Button className="cursor-pointer font-geist font-medium text-sm text-[#FAFAFA] bg-[#171717] hover:bg-black rounded-[8px] px-3 py-2 h-auto">
                Change
              </Button>
            </div>
          </div>

          {/* Active sessions */}
          <div className="flex flex-col gap-4 mt-1">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">Active Sessions</h2>
            </div>

            <div className="flex flex-col gap-4 mb-4">
              {sessions.map((session) =>
                session.isCurrent ? (
                  <div
                    key={session.id}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0A0A0A]">
                        {session.name}
                      </span>
                      <span className="font-geist font-medium text-[11px] text-white bg-[#14AE5C] rounded-full px-2 py-0.5">
                        Current
                      </span>
                    </div>
                    <span className="text-sm text-[#757575]">
                      {session.location} • {session.lastActive}
                    </span>
                  </div>
                ) : (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[#0A0A0A]">
                        {session.name}
                      </span>
                      <span className="text-sm text-[#757575]">
                        {session.location} • {session.lastActive}
                      </span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      className="cursor-pointer font-geist font-medium text-sm rounded-[8px] px-3 py-2 h-auto border border-input bg-transparent text-[#171717] hover:bg-accent hover:text-accent-foreground shadow-xs"
                    >
                      Revoke
                    </Button>
                  </div>
                )
              )}
            </div>

            <div>
              <Button
                type="button"
                onClick={handleLogoutOthers}
                className="cursor-pointer font-geist font-medium text-sm text-[#FFFFFF] bg-[#DC2626] hover:bg-[#B91C1C] rounded-[8px] px-3 py-2 h-auto"
              >
                Log out all other sessions
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
