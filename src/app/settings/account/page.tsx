"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateUser, deleteUser } from "@/lib/api/user";
import { toast } from "@/lib/toast-helper";

export default function SettingsAccountPage() {
  const { user, refreshUser, logout } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form when user loads from context (first fetch after hydration)
  const syncFromUser = useEffectEvent((u: typeof user) => {
    setFirstName(u?.firstName ?? "");
    setLastName(u?.lastName ?? "");
    setPhoneNumber(u?.phoneNumber ?? "");
  });

  useEffect(() => {
    syncFromUser(user);
  }, [user]);

  const isDirty =
    firstName.trim() !== (user?.firstName ?? "").trim() ||
    lastName.trim() !== (user?.lastName ?? "").trim() ||
    phoneNumber.trim() !== (user?.phoneNumber ?? "").trim();

  const email = user?.email ?? "";

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
        segments.length > 1 ? segments[segments.length - 1].charAt(0) : "";
      const combo = (first + last).trim();
      if (combo) return combo.toUpperCase();
    }
    return "U";
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateUser({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone_number: phoneNumber.trim() || null,
      });
      if (!updated) throw new Error("No response from server.");
      await refreshUser();
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Failed to save profile", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUser();
      setShowDeleteConfirm(false);
      toast.success("Account deactivated");
      // Give the toast a moment to show before redirecting
      setTimeout(() => logout(), 1000);
    } catch {
      toast.error("Failed to deactivate account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <>
        {/* Deactivated account banner */}
        {user?.active === false && (
          <div className="mx-auto max-w-4xl mt-6 px-4">
            <div className="flex items-start gap-3 rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[#991B1B]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Account deactivated</p>
                <p className="text-xs mt-0.5">
                  Your account has been deactivated. Contact support to restore
                  access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-[#171717]">
                Deactivate account?
              </DialogTitle>
              <DialogDescription className="text-[#6B7280]">
                This will deactivate your account and log you out. Your data is
                preserved and can be restored by contacting support.
                {email && (
                  <span className="mt-1 block font-medium text-[#374151]">
                    {email}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating…
                  </>
                ) : (
                  "Yes, deactivate"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              {/* Avatar */}
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

              {/* Fields */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex flex-row gap-4 flex-wrap">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[#111827]">
                      Email
                    </label>
                    <Input
                      value={email}
                      readOnly
                      className="min-w-xs max-w-sm bg-gray-50 cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[#111827]">
                      First name
                    </label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="min-w-[160px] max-w-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[#111827]">
                      Last name
                    </label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="min-w-[160px] max-w-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-[#111827]">
                      Phone number
                    </label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 8900"
                      type="tel"
                      className="min-w-[180px] max-w-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="h-auto px-4 py-2 rounded-[8px] bg-[#171717] text-[#FAFAFA] hover:bg-[#0F0F0F] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Sign-in Methods */}
            <section className="space-y-3">
              <h2 className="font-clash text-xl text-black">Sign-in Methods</h2>
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
                    Deactivate Account
                  </p>
                  <p className="text-xs text-[#4B5563]">
                    Deactivates your account. Your data is preserved and can be
                    restored by contacting support.
                  </p>
                  {email && (
                    <p className="text-xs text-gray-400 break-all">{email}</p>
                  )}
                </div>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={user?.active === false}
                  className="px-4 py-2 h-auto rounded-[8px] bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Deactivate
                </Button>
              </div>
            </section>
          </div>
        </div>
      </>
    </AppLayout>
  );
}
