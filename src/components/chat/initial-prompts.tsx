
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
        <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
            <Logo className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold">Flowting.ai</h1>
      </div>
      <p className="text-muted-foreground max-w-lg mx-auto">
        Hi, I&apos;m Flowting.ai — your intelligent assistant for reports, automation, and creative workflows. What would you like to explore today?
      </p>

      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {personaSuggestions.map((persona, index) => (
                <Card
                key={index}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onPromptClick(persona.title)}
                >
                <CardContent className="p-4">
                    <p className="font-semibold">{persona.title}</p>
                    <p className="text-sm text-muted-foreground">{persona.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{persona.details}</p>
                </CardContent>
                </Card>
            ))}
             <Card className="cursor-pointer hover:bg-accent transition-colors flex items-center justify-center">
                <Button variant="ghost" className="w-full h-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New
                </Button>
            </Card>
        </div>
      </div>

    </div>
  );
}
