
"use client";

import { Progress } from "@/components/ui/progress";

export function TokenTracker() {
  const usage = 25; // Static value
  const total = 100000;

  return (
    <div className="flex items-center gap-2 text-sm w-full">
      <span className="whitespace-nowrap">Token Usage:</span>
      <div className="flex-grow flex items-center gap-2">
        <Progress value={usage} className="h-2 flex-grow" indicatorClassName="bg-green-500" />
        <span className="font-mono text-muted-foreground w-20 text-right">
          {usage}%
        </span>
      </div>
    </div>
  );
}

    