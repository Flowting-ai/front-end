"use client";
import { useState } from "react";
import { ModelSwitchDialog } from "@/components/chat/model-switch-dialog";
import type { AIModel } from "@/types/ai-model";

// Mock model and chatBoards for preview
const mockModel: AIModel = {
  modelName: "GPT-4 Turbo",
  companyName: "OpenAI",
  modelType: "paid",
  version: "4.0-turbo",
  inputLimit: 128000,
  outputLimit: 4096,
};
const mockBoards = [
  { id: "chat1", name: "Product Q&A" },
  { id: "chat2", name: "Support" },
  { id: "chat3", name: "Research" },
];

export default function DevModelSwitch() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f5f5]">
      <ModelSwitchDialog
        open={open}
        onOpenChange={setOpen}
        currentModel={mockModel}
        onModelSwitch={() => {}}
        chatBoards={mockBoards}
      />
    </div>
  );
}
