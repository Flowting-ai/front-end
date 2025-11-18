
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Logo } from "../icons/logo";

interface InitialPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const personaSuggestions = [
    {
        title: "Research Analyst",
        description: "Data-driven insights",
        details: "Professional • Temp: 0.3"
    },
    {
        title: "Creative Writer",
        description: "Content generation",
        details: "Engaging • Temp: 0.8"
    },
    {
        title: "Technical Expert",
        description: "Code & architecture",
        details: "Precise • Temp: 0.2"
    }
]

export function InitialPrompts({ onPromptClick }: InitialPromptsProps) {

  return (
    <div className="text-center space-y-8 flex flex-col items-center justify-center h-full pt-16 max-w-4xl mx-auto w-full">
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-card border border-border shadow-[0_18px_45px_rgba(15,23,42,0.08)] flex items-center justify-center text-[hsl(var(--primary))]">
            <Logo className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-[hsl(var(--text-primary))]">Flowting.ai</h1>
      </div>
      <p className="text-muted-foreground max-w-lg mx-auto text-base">
        Hi, I&apos;m Flowting.ai — your intelligent assistant for reports, automation, and creative workflows. What would you like to explore today?
      </p>

      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {personaSuggestions.map((persona, index) => (
                <Card
                key={index}
                className="cursor-pointer border border-border bg-card shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(99,102,241,0.25)]"
                onClick={() => onPromptClick(persona.title)}
                >
                <CardContent className="p-4 space-y-1.5">
                    <p className="font-semibold text-[hsl(var(--text-primary))]">{persona.title}</p>
                    <p className="text-sm text-muted-foreground">{persona.description}</p>
                    <p className="text-xs text-[hsl(var(--text-soft))] mt-2">{persona.details}</p>
                </CardContent>
                </Card>
            ))}
             <Card className="cursor-pointer border border-dashed border-border bg-card/70 flex items-center justify-center shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(99,102,241,0.2)]">
                <Button variant="ghost" className="w-full h-full text-[hsl(var(--primary))] hover:bg-transparent">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New
                </Button>
            </Card>
        </div>
      </div>

    </div>
  );
}
