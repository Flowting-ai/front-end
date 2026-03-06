"use client";

import Frame1171275887 from "./frame-1171275887";

interface InitialPromptsProps {
  firstName?: string | null;
}

export function InitialPrompts({
  firstName,
}: InitialPromptsProps) {
  return (
    <div className="mx-auto flex w-full max-w-[932px] flex-col items-center gap-10">
      <Frame1171275887 firstName={firstName} />
    </div>
  );
}
