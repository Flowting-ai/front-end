"use client";

import { useState, useEffect } from "react";
import { getGreeting, getSubheading } from "@/lib/greetings";
import { useAuth } from "@/context/auth-context";
import { Sparkles, FileText, Code, Lightbulb } from "lucide-react";

const PROMPT_SUGGESTIONS = [
  {
    icon: <Sparkles size={16} />,
    title: "Help me brainstorm",
    prompt:
      "Help me brainstorm creative solutions for a project I'm working on.",
  },
  {
    icon: <FileText size={16} />,
    title: "Summarize a document",
    prompt:
      "I'd like you to summarize a document for me. I'll paste the content.",
  },
  {
    icon: <Code size={16} />,
    title: "Debug my code",
    prompt:
      "I have a bug in my code and need help debugging it. Let me describe the issue.",
  },
  {
    icon: <Lightbulb size={16} />,
    title: "Explain a concept",
    prompt:
      "Explain a complex topic to me in simple terms. I'll tell you what I want to learn about.",
  },
];

interface InitialPromptsProps {
  onPromptSelect: (prompt: string) => void;
}

export function InitialPrompts({ onPromptSelect }: InitialPromptsProps) {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [subheading, setSubheading] = useState("");

  useEffect(() => {
    const name = user?.firstName || user?.name || "there";
    setGreeting(getGreeting(name));
    setSubheading(getSubheading());
  }, [user]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {/* Greeting */}
      <h1
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "24px",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--neutral-900)",
          margin: "0 0 8px",
          lineHeight: 1.3,
        }}
      >
        {greeting}
      </h1>

      {/* Subheading */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--font-size-body-md)",
          color: "var(--neutral-500)",
          margin: "0 0 40px",
          lineHeight: 1.5,
          maxWidth: "480px",
        }}
      >
        {subheading}
      </p>

      {/* Suggestion grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          width: "100%",
        }}
      >
        {PROMPT_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onPromptSelect(suggestion.prompt)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--neutral-200)",
              backgroundColor: "var(--neutral-white)",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--neutral-50)";
              e.currentTarget.style.borderColor = "var(--neutral-300)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--neutral-white)";
              e.currentTarget.style.borderColor = "var(--neutral-200)";
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--neutral-100)",
                color: "var(--neutral-600)",
                flexShrink: 0,
              }}
            >
              {suggestion.icon}
            </span>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--neutral-900)",
                  marginBottom: "2px",
                }}
              >
                {suggestion.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--neutral-500)",
                  lineHeight: 1.4,
                }}
              >
                {suggestion.prompt.slice(0, 60)}…
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
