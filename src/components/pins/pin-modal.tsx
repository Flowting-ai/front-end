"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PIN_TAG_DESCRIPTIONS,
  PIN_TAGS,
  type Pin,
  type PinDraft,
  type PinTag,
} from "./types";

export type PinModalMode = "create" | "edit" | "view";

interface PinModalProps {
  open: boolean;
  mode: PinModalMode;
  pin?: Pin;
  onClose: () => void;
  onSubmit?: (draft: PinDraft) => void;
  onInsert?: (pin: Pin) => void;
  onRequestEdit?: () => void;
}

export function PinModal({
  open,
  mode,
  pin,
  onClose,
  onSubmit,
  onInsert,
  onRequestEdit,
}: PinModalProps) {
  const [title, setTitle] = useState(pin?.title ?? "");
  const [type, setType] = useState(pin?.type ?? "Notes");
  const [content, setContent] = useState(pin?.content ?? "");
  const [selectedTag, setSelectedTag] = useState<PinTag>(
    pin?.tag ?? PIN_TAGS[0]
  );

  const isReadOnly = mode === "view";

  const getInitialTag = () => pin?.tag ?? PIN_TAGS[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(pin?.title ?? "");
    setType(pin?.type ?? "Notes");
    setContent(pin?.content ?? "");
    setSelectedTag(getInitialTag());
  }, [open, pin, mode]);

  const handleTagSelect = (tag: PinTag) => {
    setSelectedTag(tag);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }

    onSubmit?.({
      id: pin?.id,
      title,
      type,
      content,
      tag: selectedTag,
      accentColor: pin?.accentColor,
      isFavorite: pin?.isFavorite ?? false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create Pin"
              : mode === "edit"
                ? "Edit Pin"
                : pin?.title}
          </DialogTitle>
          <DialogDescription>
            {mode === "view"
              ? "Pin saved for quick reuse."
              : "Give your pin a title, label, and short description."}
          </DialogDescription>
        </DialogHeader>

        {isReadOnly && pin ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
                {pin.type}
              </Badge>
              {pin.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {pin.updatedAt}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{pin.content}</p>
            {pin.tag && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {pin.tag}
                </Badge>
                <span>{PIN_TAG_DESCRIPTIONS[pin.tag]}</span>
              </div>
            )}
            <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => onRequestEdit?.()}
                disabled={!onRequestEdit}
              >
                Edit Pin
              </Button>
              <Button onClick={() => pin && onInsert?.(pin)}>Insert to Chat</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Summarize what this pin solves"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Type</label>
              <Input
                value={type}
                onChange={(event) => setType(event.target.value)}
                placeholder="Tone, Actions, Notes..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Details</label>
              <Textarea
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Add 2-3 bullet lines so you can recall the pin quickly."
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Tag this pin
                </label>
                <span className="text-xs text-muted-foreground">Pick the best fit</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PIN_TAGS.map((tag) => {
                  const isActive = selectedTag === tag;
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                          : "border-dashed border-slate-200 text-slate-600 hover:border-slate-400"
                      )}
                      aria-pressed={isActive}
                    >
                      <div className="text-sm font-semibold">{tag}</div>
                      <p
                        className={cn(
                          "text-xs mt-1",
                          isActive ? "text-white/80" : "text-slate-500"
                        )}
                      >
                        {PIN_TAG_DESCRIPTIONS[tag]}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Tone, Actions, Notes, and Formats cover every reusable behavior -- no extra tags needed.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {mode === "create" ? "Create Pin" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
