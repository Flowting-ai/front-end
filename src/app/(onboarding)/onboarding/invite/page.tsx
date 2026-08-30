"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { CancelOneIcon } from "@strange-huge/icons";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceOnboarding } from "@/context/workspace-onboarding-context";
import { updateOnboarding } from "@/lib/api/user";
import { inviteMembers } from "@/lib/api/teams";
import { listOrganizations } from "@/lib/api/organization";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";
import { Badge } from "@/components/Badge";
import { ChipInput } from "@/components/ChipInput";
import { StepCanvas, StepHeader, StepFooter, FieldLabel } from "../_components/step-shell";
import { ONBOARDING_PROFILE_ROUTE, WELCOME_ROUTE } from "@/lib/routes";

// Simple format check, not a deliverability check — "secure email verification
// method" per the spec means catching obviously-malformed entries before they
// reach the backend, not confirming the mailbox exists.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── A1 screen 4 — "Invite your team members" ─────────────────────────────────
// Figma: node 27:1353. No error/field-rules annotation node exists for this
// screen (unlike workspace/profile) — inviting is optional, hence the "Skip
// for now" button alongside Next (this is the only one of the 3 form steps
// with a 3-button footer: Back / Skip for now / Next).
//
// This step is also where onboarding completes (mirrors the previous flow's
// invite page): there is no dedicated route for A1 screen 5 ("Into the app" +
// "Add Souvenir to Slack" modal, node 55-2475) — that screen is the home/
// new-chat page with a modal overlay, not a distinct onboarding step, so it's
// reached by finishing here and landing on /welcome with a flag that shows
// the Slack modal (see AddSouvenirToSlackModal in ../_components).

export default function OnboardingInvitePage() {
  const { push } = useRouter();
  const { user } = useAuth();
  const { data, setInviteEmailList, setInviteEmailDraft } = useWorkspaceOnboarding();
  // Held in WorkspaceOnboardingContext (not local state) so typed-in emails —
  // committed chips and whatever's still sitting in the input — survive
  // clicking Back to profile/workspace and then Next again; a plain
  // useState here was wiped on remount, silently dropping anything typed.
  const emailInput = data.inviteEmailDraft;
  const emailList = data.inviteEmailList;
  const setEmailInput = setInviteEmailDraft;
  const setEmailList = setInviteEmailList;
  const [submitting, setSubmitting] = useState(false);

  // Splits raw comma/newline-separated text against the already-committed
  // list, sorting each entry into: added (new + well-formed), invalid
  // (fails the format check), or duplicate (already in `existing`, case-
  // insensitively — including duplicates within the same paste batch).
  function partitionEmailInput(raw: string, existing: string[]) {
    const parts = raw.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean);
    const seen = new Set(existing.map((e) => e.toLowerCase()));
    const additions: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    for (const part of parts) {
      if (!EMAIL_RE.test(part)) { invalid.push(part); continue; }
      const key = part.toLowerCase();
      if (seen.has(key)) { duplicates.push(part); continue; }
      seen.add(key);
      additions.push(part);
    }
    return { additions, invalid, duplicates };
  }

  function notifyInvalidAndDuplicates(invalid: string[], duplicates: string[]) {
    if (invalid.length > 0) {
      toast.error(
        invalid.length === 1
          ? `"${invalid[0]}" isn't a valid email address`
          : `${invalid.length} entries weren't valid email addresses`,
      );
    }
    if (duplicates.length > 0) {
      toast.error(
        duplicates.length === 1
          ? `"${duplicates[0]}" is already added`
          : `${duplicates.length} emails were already added`,
      );
    }
  }

  // Parses whatever's currently typed (comma/newline-separated), keeps only
  // well-formed, not-yet-added addresses, and folds them into the committed
  // list — same trim/dedupe/clear-input shape as EditProjectModal's tag chips.
  function commitEmails(raw: string) {
    const { additions, invalid, duplicates } = partitionEmailInput(raw, emailList);
    if (additions.length > 0) setEmailList([...emailList, ...additions]);
    notifyInvalidAndDuplicates(invalid, duplicates);
    setEmailInput("");
  }

  function removeEmail(email: string) {
    setEmailList(emailList.filter((e) => e !== email));
  }

  // Pasting "a@b.com, c@d.com" (or newline-separated) commits immediately —
  // only bare single-address typing waits for Enter/comma/blur.
  function handleEmailInputChange(next: string) {
    if (/[\n,]/.test(next)) { commitEmails(next); return; }
    setEmailInput(next);
  }

  const finish = async () => {
    // Persisting completion is the only call that gates entry to the app (see
    // the previous flow's equivalent step) — must succeed before navigating.
    // Role/tone (typed in on the profile step, held in
    // WorkspaceOnboardingContext since then) are sent here rather than from
    // the profile page itself: role_fit is already set by that point, so
    // sending user_role+ai_tone from the profile step would satisfy the
    // backend's "all three set → auto-complete" rule (update_onboarding)
    // before the invite step ever ran, skipping it entirely. Sending them
    // together with onboarding_completed here means completion only ever
    // happens on this explicit call.
    const result = await updateOnboarding({
      ...(data.role ? { user_role: data.role } : {}),
      ...(data.tone ? { ai_tone: data.tone } : {}),
      onboarding_completed: true,
    });
    if (!result?.completed) {
      toast.error("Couldn't finish setup. Please try again.");
      return false;
    }
    return true;
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (await finish()) window.location.href = `${WELCOME_ROUTE}?slack=1`;
    } catch (err) {
      console.error("Onboarding completion failed", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Fold in whatever's still sitting in the input (typed but not yet
      // committed via Enter/comma/blur) so clicking Next doesn't silently
      // drop the last address someone typed.
      let finalEmails = emailList;
      const pendingRaw = emailInput.trim();
      if (pendingRaw) {
        const { additions, invalid, duplicates } = partitionEmailInput(pendingRaw, emailList);
        notifyInvalidAndDuplicates(invalid, duplicates);
        finalEmails = [...emailList, ...additions];
        setEmailList(finalEmails);
        setEmailInput("");
      }
      if (finalEmails.length > 0) {
        try {
          let orgId = user?.orgId ?? null;
          if (!orgId) {
            const orgs = await listOrganizations();
            orgId = orgs[0]?.id ?? null;
          }
          if (orgId) {
            await inviteMembers(orgId, finalEmails);
          } else {
            // No org found at all — the workspace step's createOrganization()
            // call likely failed silently. Surface it instead of the previous
            // behavior of just dropping the invite with no feedback at all.
            console.error("Team invite skipped — no organization id resolved");
            toast.error("Couldn't send invites — no workspace was found for your account. You can add members later in Settings → Members.");
          }
        } catch (inviteErr) {
          // Non-fatal — don't block completion over a failed invite send.
          // Surface the real reason (e.g. "X is already a member" / "Invite
          // already sent to X") instead of a generic message that hides why
          // it failed — ApiError.message is already backend-provided and
          // safe to show verbatim (see friendlyApiError in lib/api/client.ts).
          console.error("Team invite failed", inviteErr);
          const detail = inviteErr instanceof ApiError ? inviteErr.message : null;
          toast.error(
            detail ? `Couldn't send invites: ${detail}` : "Couldn't send invites — you can add members later in Settings → Members.",
          );
        }
      }
      if (await finish()) window.location.href = `${WELCOME_ROUTE}?slack=1`;
    } catch (err) {
      console.error("Onboarding completion failed", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepCanvas>
      <StepHeader total={3} activeIndex={2} title="Invite your team members" />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", padding: "24px 0 0" }}>
        <FieldLabel>Enter email ids</FieldLabel>
        <div
          onClick={(e) => { if (e.target === e.currentTarget) (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus(); }}
          // Caps at ~10 rows of chips (Badge's 20px min-height + 6px row gap,
          // ~26px/row) then scrolls internally instead of growing the page
          // forever — kaya-scrollbar is this design system's standard thin
          // scrollbar treatment for any element that gets overflow-y: auto.
          className="kaya-scrollbar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            width: "100%",
            minHeight: 122,
            maxHeight: 260,
            overflowY: "auto",
            overscrollBehaviorY: "contain",
            padding: "7px 10px",
            borderRadius: 10,
            backgroundColor: "var(--neutral-white,#fff)",
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#ede1d7)",
            boxSizing: "border-box",
            alignContent: "flex-start",
            cursor: "text",
          }}
        >
          <AnimatePresence initial={false}>
            {emailList.map((email) => (
              <m.div
                key={email}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.12 }}
                style={{ display: "flex", alignItems: "center", gap: 2 }}
              >
                <Badge label={email} color="Neutral" />
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  aria-label={`Remove ${email}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    color: "var(--neutral-500)",
                  }}
                >
                  <CancelOneIcon style={{ width: 10, height: 10 }} />
                </button>
              </m.div>
            ))}
          </AnimatePresence>
          <ChipInput
            placeholder="Enter your email id"
            // ChipInput's own default cap (30) is sized for short tags. This
            // field also accepts pasting several comma/newline-separated
            // emails at once (see handleEmailInputChange), so the cap needs
            // to cover a whole batch of addresses, not just one RFC-5321
            // address (254 chars) — otherwise a multi-email paste gets
            // silently rejected by ChipInput before the splitting logic ever
            // sees it.
            maxLength={2000}
            // ChipInput's own default width is a 64px floor that only grows
            // with typed content (Figma 3118:32829's tag-sizing) — fine for a
            // short tag, but it leaves an email field looking like a tiny box
            // in this much taller container. Let it fill the row instead.
            style={{ flex: "1 1 240px" }}
            value={emailInput}
            onChange={(e) => handleEmailInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitEmails(emailInput); }
            }}
            onBlur={() => commitEmails(emailInput)}
            aria-label="New email address"
          />
        </div>
      </div>

      <StepFooter
        onBack={() => push(ONBOARDING_PROFILE_ROUTE)}
        onSkip={() => void handleSkip()}
        skipDisabled={submitting}
        onNext={() => void handleNext()}
        nextLabel={emailList.length > 1 ? `Invite ${emailList.length} & continue` : "Next"}
        nextLoading={submitting}
      />
    </StepCanvas>
  );
}
