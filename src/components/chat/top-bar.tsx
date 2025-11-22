"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HardDrive, Bot } from "lucide-react";

export function TopBar() {
  return (
    <div className="border-b border-slate-200 bg-white/70 backdrop-blur-sm px-4 py-2 sm:px-6 lg:px-10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Select>
          <SelectTrigger className="rounded-full h-9 w-[200px]">
            <SelectValue
              placeholder={
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span>Select Model</span>
                </div>
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground whitespace-nowrap">Token count: 4,096 / 8,192</div>
        <Button variant="outline" size="sm" className="rounded-full">
          Upgrade Plan
        </Button>
      </div>
      <div className="flex items-center">
        <Button variant="outline" className="rounded-full h-9 gap-2">
          <Bot className="h-4 w-4" />
          Create Persona
        </Button>
      </div>
    </div>
  );
}
