"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExampleConversation = {
  id: string;
  userSays: string;
  personaReplies: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (conversation: ExampleConversation) => void;
};

export default function ExampleConversationDialog({ open, onClose, onAdd }: Props) {
  const [userSays, setUserSays] = useState("");
  const [personaReplies, setPersonaReplies] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    if (!personaReplies.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      userSays: userSays.trim(),
      personaReplies: personaReplies.trim(),
    });
    setUserSays("");
    setPersonaReplies("");
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white flex flex-col gap-3 p-3 rounded-[18px] w-[480px] max-w-[calc(100vw-32px)]"
        style={{
          boxShadow:
            "0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-medium text-[#1a1916] leading-[1.4]">
            Example conversations <span className="font-normal text-[#6a625d]">( optional )</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center p-[3px] rounded-[6px] text-[#6a625d] hover:bg-[#f7f2ed] transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-[#ee3030] leading-[1.57]">User says:</label>
            <div
              className="flex items-center gap-[2px] px-[10px] py-[7px] rounded-[10px] bg-white"
              style={{ boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7" }}
            >
              <input
                type="text"
                value={userSays}
                onChange={(e) => setUserSays(e.target.value)}
                placeholder="e.g. I need help reviewing the redesign"
                className="flex-1 text-[14px] text-[#1a1916] placeholder:text-[#6a625d] bg-transparent outline-none leading-[1.57] min-w-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[14px] text-[#524b47] leading-[1.57]">
              Persona replies<span className="text-[#a28847]">*</span>
            </label>
            <div
              className="flex items-start gap-[2px] px-[10px] py-[7px] rounded-[10px] bg-white"
              style={{
                minHeight: 129,
                boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
              }}
            >
              <textarea
                value={personaReplies}
                onChange={(e) => setPersonaReplies(e.target.value)}
                placeholder="e.g. All discovery and design work for the V2 redesign"
                className="flex-1 text-[14px] text-[#1a1916] placeholder:text-[#6a625d] bg-transparent outline-none leading-[1.57] resize-none min-w-0 h-full"
                style={{ minHeight: 105 }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!personaReplies.trim()}
            onClick={handleAdd}
            className={cn(
              "flex items-center gap-[2px] px-[10px] pb-2 pt-[6px] rounded-[10px] text-[14px] font-medium relative overflow-hidden transition-opacity",
              !personaReplies.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            )}
            style={{
              background: "linear-gradient(to bottom, #524b47, #26211e)",
              color: "#f7f2ed",
              boxShadow:
                "0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4), inset 0px 1.455px 0.364px 0px #6a625d, inset 0px -2.182px 0.364px 0px #3b3632, inset 0px -2.545px 6.9px -2.182px #827a74",
              textShadow: "0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)",
            }}
          >
            Add example conversation
          </button>
        </div>
      </div>
    </div>
  );
}
