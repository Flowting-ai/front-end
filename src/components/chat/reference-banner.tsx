"use client";

import { X, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Message } from "./chat-message";

interface ReferenceBannerProps {
  referencedMessage: Message;
  onClear: () => void;
}

export function ReferenceBanner({
  referencedMessage,
  onClear,
}: ReferenceBannerProps) {
  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <div className="relative mx-auto w-full max-w-[min(1400px,100%)] px-4 sm:px-6 lg:px-10 mb-2">
      <div className="flex items-center gap-3 p-3 rounded-[20px] bg-blue-50 border border-blue-200">
        <CornerDownRight className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700 mb-0.5">
            Replying to:
          </p>
          <p className="text-sm text-blue-900 truncate">
            {truncateText(referencedMessage.content)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-7 w-7 rounded-full hover:bg-blue-100 flex-shrink-0"
        >
          <X className="h-4 w-4 text-blue-600" />
        </Button>
      </div>
    </div>
  );
}
