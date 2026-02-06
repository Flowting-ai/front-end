"use client";

import React from "react";

// Helper function to render inline markdown (bold, italic, code) as React nodes
export const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let key = 0;
  
  // Combined regex to match bold (**text** or __text__), italic (*text* or _text_), and code (`text`)
  // Priority: code first, then bold, then italic
  const combinedRegex = /(`[^`]+`)|(\*\*|__)((?:(?!\2).)+)\2|(\*|_)((?:(?!\4).)+)\4/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Code: `text`
      const code = match[1].slice(1, -1); // Remove backticks
      parts.push(
        <code key={`code-${key++}`} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
          {code}
        </code>
      );
    } else if (match[2]) {
      // Bold: **text** or __text__
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold">
          {match[3]}
        </strong>
      );
    } else if (match[4]) {
      // Italic: *text* or _text_
      parts.push(
        <em key={`italic-${key++}`} className="italic">
          {match[5]}
        </em>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Helper function to strip markdown symbols for plain text display
export const stripMarkdown = (text: string): string => {
  if (!text) return text;
  
  return text
    // Remove heading markers
    .replace(/^#+\s+/gm, '')
    // Remove bold markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    // Remove italic markers
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove code markers
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper function to format pin title by removing heading markers
export const formatPinTitle = (text: string): string => {
  if (!text) return text;
  // Remove heading markers
  return text.replace(/^#+\s+/, '');
};
