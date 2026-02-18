"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Send, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClarificationData {
  question: string;
  options: string[];
  chatId: string;
  chatTitle?: string;
}

interface ClarificationPromptProps {
  data: ClarificationData;
  onSelect: (answer: string) => void;
  isSubmitting?: boolean;
}

export function ClarificationPrompt({
  data,
  onSelect,
  isSubmitting = false,
}: ClarificationPromptProps) {
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Smooth entrance animation
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleOptionClick = (option: string) => {
    if (isSubmitting) return;
    setSelectedOption(option);
    setTimeout(() => {
      onSelect(option);
    }, 150);
  };

  const handleCustomSubmit = () => {
    if (isSubmitting || !customInput.trim()) return;
    setSelectedOption(customInput.trim());
    setTimeout(() => {
      onSelect(customInput.trim());
    }, 150);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-5 bg-white border border-[#E8E8E8] rounded-2xl shadow-sm",
        "transform transition-all duration-300 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      style={{ maxWidth: "480px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shrink-0">
          <HelpCircle className="h-[18px] w-[18px] text-blue-500" />
        </div>
        <p className="text-[15px] font-medium text-[#1E1E1E] leading-snug">
          {data.question}
        </p>
      </div>

      {/* Options - Vertical List */}
      <div className="flex flex-col gap-2">
        {data.options.map((option, index) => (
          <button
            key={index}
            disabled={isSubmitting}
            onClick={() => handleOptionClick(option)}
            className={cn(
              "group flex items-center justify-between w-full px-4 py-3 rounded-xl text-left",
              "border border-[#E8E8E8] bg-[#FAFAFA]",
              "transition-all duration-150 ease-out",
              "hover:bg-[#F0F0F0] hover:border-[#D0D0D0]",
              "active:scale-[0.99]",
              selectedOption === option && "bg-[#1E1E1E] border-[#1E1E1E] text-white",
              isSubmitting && "opacity-60 pointer-events-none"
            )}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            <span
              className={cn(
                "text-[14px] font-medium text-[#1E1E1E]",
                selectedOption === option && "text-white"
              )}
            >
              {option}
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-[#AAAAAA] transition-transform duration-150",
                "group-hover:translate-x-0.5 group-hover:text-[#666666]",
                selectedOption === option && "text-white"
              )}
            />
          </button>
        ))}

        {/* Custom answer option */}
        {!showCustomInput ? (
          <button
            disabled={isSubmitting}
            onClick={() => setShowCustomInput(true)}
            className={cn(
              "flex items-center justify-between w-full px-4 py-3 rounded-xl text-left",
              "border border-dashed border-[#D0D0D0] bg-transparent",
              "transition-all duration-150 ease-out",
              "hover:bg-[#FAFAFA] hover:border-[#AAAAAA]",
              isSubmitting && "opacity-60 pointer-events-none"
            )}
          >
            <span className="text-[14px] font-medium text-[#888888]">
              Other (type your own)
            </span>
            <ChevronRight className="h-4 w-4 text-[#CCCCCC]" />
          </button>
        ) : (
          <div
            className={cn(
              "flex gap-2 p-1 rounded-xl border border-[#E8E8E8] bg-[#FAFAFA]",
              "transition-all duration-200 ease-out"
            )}
          >
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 text-[14px] h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 px-3"
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
                if (e.key === "Escape") {
                  setShowCustomInput(false);
                  setCustomInput("");
                }
              }}
              autoFocus
            />
            <Button
              size="sm"
              disabled={isSubmitting || !customInput.trim()}
              onClick={handleCustomSubmit}
              className={cn(
                "h-10 w-10 rounded-lg bg-[#1E1E1E] hover:bg-[#0A0A0A] p-0",
                "disabled:bg-[#E0E0E0]"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Submitting indicator */}
      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-4 w-4 text-[#888888] animate-spin" />
          <p className="text-[13px] text-[#888888]">Processing...</p>
        </div>
      )}
    </div>
  );
}
