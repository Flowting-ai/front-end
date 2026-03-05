"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsAccountPage() {
  const { user } = useAuth();

  const { fullNameDefault, displayNameDefault, email } = useMemo(() => {
    const firstName =
      (user?.firstName && user.firstName.trim()) ||
      (user?.name && user.name.trim().split(/\s+/)[0]) ||
      (user?.email && user.email.split("@")[0]) ||
      "";

    let lastName = "";
    if (user?.lastName && user.lastName.trim()) {
      lastName = user.lastName.trim();
    } else if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length > 1) {
        lastName = parts.slice(1).join(" ");
      }
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return {
      fullNameDefault: fullName,
      displayNameDefault: firstName,
      email: user?.email ?? "",
    };
  }, [user]);

  const [fullName, setFullName] = useState(fullNameDefault);
  const [displayName, setDisplayName] = useState(displayNameDefault);

  const syncNamesFromDefaults = useEffectEvent(
    (nextFullNameDefault: string, nextDisplayNameDefault: string) => {
      setFullName(nextFullNameDefault);
      setDisplayName(nextDisplayNameDefault);
    }
  );

  useEffect(() => {
    syncNamesFromDefaults(fullNameDefault, displayNameDefault);
  }, [fullNameDefault, displayNameDefault]);

  const avatarInitials = useMemo(() => {
    if (user?.firstName || user?.lastName) {
      const first = (user.firstName ?? "").trim().charAt(0);
      const last = (user.lastName ?? "").trim().charAt(0);
      const combo = (first + last).trim();
      if (combo) return combo.toUpperCase();
    }
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      const first = parts[0]?.charAt(0) ?? "";
      const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
      const combo = (first + last).trim();
      if (combo) return combo.toUpperCase();
    }
    if (user?.email) {
      const [local] = user.email.split("@");
      const segments = local.split(/[.\s_-]/).filter(Boolean);
      const first = segments[0]?.charAt(0) ?? "";
      const last =
        segments.length > 1
          ? segments[segments.length - 1].charAt(0)
          : "";
      const combo = (first + last).trim();
      if (combo) return combo.toUpperCase();
    }
    return "U";
  }, [user]);

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4">
        <div className="w-full max-w-4xl space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-3xl text-black">Account</h1>
            <p className="font-geist text-sm text-[#4B5563]">
              Manage your personal profile and preferences.
            </p>
          </div>

          {/* Profile row */}
          <div className="w-full flex items-start gap-4 border-b border-[#E5E5E5] pb-6">
            {/* Avatar + upload */}
            <div className="relative">
              <Avatar className="w-16 h-16 border border-[#E5E5E5]">
                <AvatarFallback className="bg-[#F3F4F6] text-[#111827] font-medium">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white border border-white shadow-sm"
                aria-label="Upload profile picture"
              >
                <Upload size={14} />
              </button>
            </div>

            {/* Name fields */}
            <div className="flex-1 flex flex-row gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-[#111827]">
                  Full Name
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="min-w-xs max-w-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-[#111827]">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="min-w-xs max-w-md"
                />
              </div>
            </div>
          </div>

          {/* Sign-in Methods */}
          <section className="space-y-3">
            <h2 className="font-clash text-xl text-black">
              Sign-in Methods
            </h2>
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#111827]">
                  Edit your Email &amp; Password
                </p>
                <p className="text-xs text-gray-400">
                  Update your sign-in details securely.
                </p>
              </div>
              <Button className="px-4 py-2 h-auto rounded-[8px] bg-black text-white hover:bg-black/90">
                Edit
              </Button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-3">
            <h2 className="font-clash text-xl text-black">Danger Zone</h2>
            <div className="flex items-center justify-between pb-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#B91C1C]">
                  Delete Account
                </p>
                <p className="text-xs text-[#4B5563]">
                  Permanently delete your account and all data.
                </p>
                {email && (
                  <p className="text-xs text-gray-400 break-all">
                    {email}
                  </p>
                )}
              </div>
              <Button className="px-4 py-2 h-auto rounded-[8px] bg-red-500 text-white hover:bg-red-600">
                Delete
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

