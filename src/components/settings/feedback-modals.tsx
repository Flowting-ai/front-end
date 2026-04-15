"use client";

import React, { useRef, useCallback } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// ─── Auto-resize textarea hook ────────────────────────────────────────────────

function useAutoResizeTextarea() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const onInput = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  return { ref, onInput };
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm font-geist text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow";

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessView({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center px-6 py-8">
      <p className="font-clash text-xl text-black">{title}</p>
      <p className="font-geist text-sm text-[#525252] leading-relaxed">{body}</p>
      <button
        onClick={onClose}
        className="w-full mt-2 bg-black text-white font-geist text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-[#1a1a1a] transition-colors"
      >
        Close
      </button>
    </div>
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Report Bug Modal ─────────────────────────────────────────────────────────

export function ReportBugModal({ open, onOpenChange }: ModalProps) {
  const [state, handleSubmit] = useForm("xjgjgopw");
  const textarea = useAutoResizeTextarea();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[480px] p-0 rounded-2xl overflow-hidden border-0 shadow-xl"
      >
        {state.succeeded ? (
          <SuccessView
            title="Thanks for reporting!"
            body="We'll look into this as soon as possible. Your feedback helps our team build a better Souvenir."
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="hidden" name="form_type" value="report_bug" />
            <div className="p-6 flex flex-col gap-5">
              {/* Header */}
              <div className="flex flex-col gap-1.5">
                <h2 className="font-clash text-xl text-black">Report a Bug</h2>
                <p className="font-geist text-sm text-[#525252] leading-relaxed">
                  We&apos;re sorry something didn&apos;t work right. Your feedback helps our
                  small team build a better Souvenir.
                </p>
              </div>

              {/* Name + Email row */}
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <input
                    id="bug-name"
                    type="text"
                    name="name"
                    required
                    placeholder="Your name"
                    className={inputClass}
                  />
                  <div className="text-xs text-red-500 font-geist">
                    <ValidationError prefix="Name" field="name" errors={state.errors} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <input
                    id="bug-email"
                    type="email"
                    name="email"
                    required
                    placeholder="Your email"
                    className={inputClass}
                  />
                  <div className="text-xs text-red-500 font-geist">
                    <ValidationError prefix="Email" field="email" errors={state.errors} />
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <div className="flex flex-col gap-1.5">
                <textarea
                  ref={textarea.ref}
                  id="bug-message"
                  name="message"
                  required
                  rows={5}
                  onInput={textarea.onInput}
                  placeholder="Describe what happened..."
                  className="w-full min-h-[120px] resize-none overflow-hidden rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm font-geist text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow"
                />
                <div className="text-xs text-red-500 font-geist">
                  <ValidationError prefix="Message" field="message" errors={state.errors} />
                </div>
              </div>

              {/* General form errors */}
              <div className="text-xs text-red-500 font-geist">
                <ValidationError errors={state.errors} />
              </div>

              {/* Buttons — submit on top, cancel below */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={state.submitting}
                  className="w-full bg-black text-white font-geist text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.submitting ? "Submitting…" : "Report Bug"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full bg-white text-[#0A0A0A] font-geist text-sm font-medium py-2.5 px-4 rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Feature Request Modal ────────────────────────────────────────────────────

export function FeatureRequestModal({ open, onOpenChange }: ModalProps) {
  const [state, handleSubmit] = useForm("mrerelnz");
  const textarea = useAutoResizeTextarea();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[480px] p-0 rounded-2xl overflow-hidden border-0 shadow-xl"
      >
        {state.succeeded ? (
          <SuccessView
            title="Thanks for the idea!"
            body="We read every request. You might just see it in Souvenir soon."
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="hidden" name="form_type" value="feature_request" />
            <div className="p-6 flex flex-col gap-5">
              {/* Header */}
              <div className="flex flex-col gap-1.5">
                <h2 className="font-clash text-xl text-black">
                  Request a Feature
                </h2>
                <p className="font-geist text-sm text-[#525252] leading-relaxed">
                  We&apos;re a small team building Souvenir with you, not just for you.
                  Tell us what would make your experience better — we read every
                  request.
                </p>
              </div>

              {/* Name + Email row */}
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <input
                    id="feature-name"
                    type="text"
                    name="name"
                    required
                    placeholder="Your name"
                    className={inputClass}
                  />
                  <div className="text-xs text-red-500 font-geist">
                    <ValidationError prefix="Name" field="name" errors={state.errors} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <input
                    id="feature-email"
                    type="email"
                    name="email"
                    required
                    placeholder="Your email"
                    className={inputClass}
                  />
                  <div className="text-xs text-red-500 font-geist">
                    <ValidationError prefix="Email" field="email" errors={state.errors} />
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <div className="flex flex-col gap-1.5">
                <textarea
                  ref={textarea.ref}
                  id="feature-message"
                  name="message"
                  required
                  rows={5}
                  onInput={textarea.onInput}
                  placeholder="I wish Souvenir could..."
                  className="w-full min-h-[120px] resize-none overflow-hidden rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm font-geist text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow"
                />
                <div className="text-xs text-red-500 font-geist">
                  <ValidationError prefix="Message" field="message" errors={state.errors} />
                </div>
              </div>

              {/* General form errors */}
              <div className="text-xs text-red-500 font-geist">
                <ValidationError errors={state.errors} />
              </div>

              {/* Buttons — submit on top, cancel below */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={state.submitting}
                  className="w-full bg-black text-white font-geist text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.submitting ? "Submitting…" : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full bg-white text-[#0A0A0A] font-geist text-sm font-medium py-2.5 px-4 rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
