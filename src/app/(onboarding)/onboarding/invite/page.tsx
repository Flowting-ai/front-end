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
import { Badge, type BadgeColor } from "@/components/Badge";
import { Button } from "@/components/ui/button";
import { StepCanvas, StepHeader, StepFooter, FieldLabel, useLeaveGuard, LeaveGuardModal } from "../_components/step-shell";
import { ONBOARDING_PROFILE_ROUTE, WELCOME_ROUTE } from "@/lib/routes";
import { isValidEmail, suggestEmail } from "@/lib/email/check";

// What's wrong with what was typed, shown under the box (the text stays in the box to fix):
// a bad format, an address already added, or a likely domain typo with a suggested fix.
// What can sit between addresses in a typed or pasted list: commas, semicolons (Outlook), line
// breaks and tabs (a spreadsheet column or row), spaces.
const SEPARATORS = /[\s,;]+/;
// Chip colours cycle in order, so no two neighbouring chips share a colour.
const CHIP_COLORS: BadgeColor[] = ["Blue", "Green", "Purple", "Yellow", "Red", "Brown"];

type EmailProblem =
  | { kind: "invalid" | "duplicate"; message: string }
  | { kind: "suggest"; typed: string; suggestion: string };

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
  // Which of Skip/Send is in flight — Skip and Next both call setSubmitting,
  // and sharing one boolean made clicking Skip show its spinner on the Next
  // button instead (the button the user didn't click).
  const [submittingAction, setSubmittingAction] = useState<"skip" | "send" | null>(null);
  const submitting = submittingAction !== null;
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const hasUnsavedChanges = emailList.length > 0 || emailInput.trim().length > 0;
  const leaveGuard = useLeaveGuard(hasUnsavedChanges);

  // Splits raw comma/newline-separated text against the already-committed list, sorting each
  // entry into: added (new + well-formed), invalid (fails the format check), duplicate (already
  // added, case-insensitively, including within the same paste), or suspect (well-formed but
  // its domain looks like a typo, e.g. gmial.com). `keepAsTyped` is a suspect the viewer chose to keep.
  function partitionEmailInput(raw: string, existing: string[], keepAsTyped?: string) {
    const parts = raw.split(SEPARATORS).map((e) => e.trim()).filter(Boolean);
    const seen = new Set(existing.map((e) => e.toLowerCase()));
    const additions: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    const suspects: { typed: string; suggestion: string }[] = [];
    for (const part of parts) {
      if (!isValidEmail(part)) { invalid.push(part); continue; }
      const key = part.toLowerCase();
      if (seen.has(key)) { duplicates.push(part); continue; }
      const suggestion = part === keepAsTyped ? null : suggestEmail(part);
      if (suggestion) { suspects.push({ typed: part, suggestion }); continue; }
      seen.add(key);
      additions.push(part);
    }
    return { additions, invalid, duplicates, suspects };
  }

  // Adds the good addresses as chips; anything wrong stays in the box with the reason under it.
  // Returns whether everything typed was added.
  function commitEmails(raw: string, keepAsTyped?: string): boolean {
    const { additions, invalid, duplicates, suspects } = partitionEmailInput(raw, emailList, keepAsTyped);
    if (additions.length > 0) setEmailList([...emailList, ...additions]);
    setEmailInput([...invalid, ...suspects.map((s) => s.typed)].join(", "));
    if (invalid.length > 0) {
      setProblem({
        kind: "invalid",
        message: invalid.length === 1
          ? `"${invalid[0]}" isn't a valid email address`
          : `${invalid.length} entries aren't valid email addresses`,
      });
    } else if (suspects.length > 0) {
      setProblem({ kind: "suggest", ...suspects[0] });
    } else if (duplicates.length > 0) {
      setProblem({
        kind: "duplicate",
        message: duplicates.length === 1 ? `"${duplicates[0]}" is already added` : `${duplicates.length} emails were already added`,
      });
    } else {
      setProblem(null);
    }
    return invalid.length === 0 && suspects.length === 0;
  }

  // The "did you mean" answers: take the fix, or keep the address as typed.
  function resolveSuggestion(use: "suggestion" | "typed") {
    if (problem?.kind !== "suggest") return;
    const rest = emailInput.split(SEPARATORS).map((e) => e.trim()).filter((e) => e && e !== problem.typed);
    const chosen = use === "suggestion" ? problem.suggestion : problem.typed;
    commitEmails([chosen, ...rest].join(", "), use === "typed" ? problem.typed : undefined);
  }

  function removeEmail(email: string) {
    setEmailList(emailList.filter((e) => e !== email));
  }

  // Typing a comma or semicolon commits; a single address otherwise waits for Enter or blur.
  function handleEmailInputChange(next: string) {
    if (/[,;]/.test(next)) { commitEmails(next); return; }
    setEmailInput(next);
    if (problem) setProblem(null);
  }

  const finish = async (toastId?: string | number) => {
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
      toast.error("Couldn't finish setup. Please try again.", toastId ? { id: toastId } : undefined);
      return false;
    }
    return true;
  };

  // "Continue" (finish onboarding + hand off to /welcome) always gets its own
  // loading/success/error toast, separate from whatever the invite send
  // reported — the two are independent outcomes (invites can fail while
  // onboarding still completes) and shouldn't share one toast's text.
  const goToWelcome = async () => {
    const toastId = toast.loading("Finishing setup…");
    try {
      if (await finish(toastId)) {
        toast.success("You're all set!", { id: toastId });
        // Intentional full navigation — suppress the leave-guard's
        // beforeunload prompt for this handoff, not just any unload.
        leaveGuard.bypass();
        window.location.href = `${WELCOME_ROUTE}?slack=1`;
      }
    } catch (err) {
      console.error("Onboarding completion failed", err);
      toast.error("Something went wrong. Please try again.", { id: toastId });
    }
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmittingAction("skip");
    try {
      await goToWelcome();
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleNext = async () => {
    if (submitting) return;
    setSubmittingAction("send");
    try {
      // Fold in whatever's still sitting in the input (typed but not yet
      // committed via Enter/comma/blur) so clicking Next doesn't silently
      // drop the last address someone typed.
      // Anything wrong (bad format, a likely typo) stays in the box with its reason, and nothing
      // is sent until it's fixed or removed.
      let finalEmails = emailList;
      const pendingRaw = emailInput.trim();
      if (pendingRaw) {
        const { additions } = partitionEmailInput(pendingRaw, emailList);
        if (!commitEmails(pendingRaw)) return;
        finalEmails = [...emailList, ...additions];
      }
      if (finalEmails.length > 0) {
        const inviteLabel = finalEmails.length === 1 ? "invite" : "invites";
        const inviteToastId = toast.loading(`Sending ${finalEmails.length} ${inviteLabel}…`);
        try {
          let orgId = user?.orgId ?? null;
          if (!orgId) {
            const orgs = await listOrganizations();
            orgId = orgs[0]?.id ?? null;
          }
          if (orgId) {
            await inviteMembers(orgId, finalEmails);
            toast.success(`Sent ${finalEmails.length} ${inviteLabel}`, { id: inviteToastId });
          } else {
            // No org found at all — the workspace step's createOrganization()
            // call likely failed silently. Surface it instead of the previous
            // behavior of just dropping the invite with no feedback at all.
            console.error("Team invite skipped — no organization id resolved");
            toast.error(
              "Couldn't send invites — no workspace was found for your account. You can add members later in Settings → Members.",
              { id: inviteToastId },
            );
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
            { id: inviteToastId },
          );
        }
      }
      await goToWelcome();
    } catch (err) {
      console.error("Onboarding completion failed", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <StepCanvas>
      <StepHeader total={3} activeIndex={2} title="Invite your team members" />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", padding: "24px 0 0" }}>
        <FieldLabel>Enter their email ids</FieldLabel>
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
            backgroundColor: "#FFFFFF",
            boxShadow: problem?.kind === "invalid"
              ? "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--red-500)"
              : problem?.kind === "suggest"
                ? "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--yellow-500)"
                : "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100,#F5F5F5)",
            transition: "box-shadow 150ms ease",
            boxSizing: "border-box",
            alignContent: "flex-start",
            cursor: "text",
          }}
        >
          <AnimatePresence initial={false}>
            {emailList.map((email, i) => (
              <m.div
                key={email}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.12 }}
                style={{ display: "flex", alignItems: "center", gap: 2 }}
              >
                <Badge label={email} color={CHIP_COLORS[i % CHIP_COLORS.length]} />
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
          {/* A plain, borderless input that fills the box like a text area; Enter or a comma turns
              what's typed into a chip, and Backspace on an empty input takes the last chip back. */}
          <input
            type="text"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder={emailList.length === 0 ? "Add email id and press enter" : ""}
            value={emailInput}
            onChange={(e) => handleEmailInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitEmails(emailInput); }
              else if (e.key === "Backspace" && emailInput === "" && emailList.length > 0) { e.preventDefault(); removeEmail(emailList[emailList.length - 1]); }
            }}
            // A pasted list is split here, before the single-line input strips its line breaks and
            // glues neighbouring addresses together (a spreadsheet column → "a@x.comb@y.com").
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!SEPARATORS.test(pasted.trim())) return;
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart ?? emailInput.length;
              const end = el.selectionEnd ?? emailInput.length;
              commitEmails(`${emailInput.slice(0, start)}${pasted}${emailInput.slice(end)}`);
            }}
            onBlur={() => { if (emailInput.trim()) commitEmails(emailInput); }}
            aria-label="Email addresses"
            aria-invalid={problem?.kind === "invalid" || undefined}
            aria-describedby="invite-email-help"
            style={{
              flex: "1 1 200px",
              minWidth: 0,
              height: 24,
              padding: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--neutral-900)",
            }}
          />
        </div>
        {/* What's wrong with what's typed, or the usual how-to when nothing is. */}
        <div id="invite-email-help" aria-live="polite" style={{ minHeight: 20, fontFamily: "var(--font-body)", fontSize: 12, lineHeight: "20px", color: "var(--neutral-500)" }}>
          {problem?.kind === "suggest" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", color: "var(--neutral-700)" }}>
              Did you mean <strong style={{ fontWeight: 500, color: "var(--neutral-900)" }}>{problem.suggestion}</strong>?
              <Button variant="outline" size="xs" onClick={() => resolveSuggestion("suggestion")}>Use it</Button>
              <Button variant="ghost" size="xs" onClick={() => resolveSuggestion("typed")}>Keep {problem.typed}</Button>
            </span>
          ) : problem ? (
            <span style={{ color: problem.kind === "invalid" ? "var(--red-600)" : "var(--neutral-600)" }}>{problem.message}</span>
          ) : (
            "Press Enter or comma after each email. You can also paste a list."
          )}
        </div>
      </div>

      <StepFooter
        onBack={() => push(ONBOARDING_PROFILE_ROUTE)}
        onSkip={() => void handleSkip()}
        skipDisabled={submitting}
        skipLoading={submittingAction === "skip"}
        onNext={() => void handleNext()}
        nextLabel={emailList.length === 0 ? "Send Invite" : `Send ${emailList.length} ${emailList.length === 1 ? "Invite" : "Invites"}`}
        nextDisabled={submitting || emailList.length === 0}
        nextLoading={submittingAction === "send"}
      />
      <LeaveGuardModal open={leaveGuard.open} onStay={leaveGuard.stay} onLeave={leaveGuard.leave} />
    </StepCanvas>
  );
}
