import { PINS_ENABLED } from "@/lib/feature-flags";

export interface GreetingSlot {
  label: string;
  messages: string[];
}

export interface TimeGreetingSlot extends GreetingSlot {
  startHour: number;
  endHour: number;
}

export interface DayGreetingSlot extends GreetingSlot {
  days: number[];
}

export const timeGreetings: TimeGreetingSlot[] = [
  {
    label: "Late Night",
    startHour: 0,
    endHour: 5,
    messages: [
      "The world's asleep. You're not. Let's make something.",
      "Burning the midnight oil, {username}? I never sleep.",
      "It's quiet out there. The best ideas are born now.",
      "Nobody's watching. Go big.",
      "Insomnia, meet ambition.",
    ],
  },
  {
    label: "Early Morning",
    startHour: 5,
    endHour: 9,
    messages: [
      "Rise and grind, {username}. I've been waiting.",
      "Fresh morning, fresh ideas - let's go.",
      "The day is a blank canvas. Let's paint.",
      "Early bird gets the breakthrough.",
      "Let's think before the inbox wakes up.",
      "Coffee's brewing. So are ideas.",
    ],
  },
  {
    label: "Late Morning",
    startHour: 9,
    endHour: 12,
    messages: [
      "Peak brain hours. Let's not waste them.",
      "The morning is still young and so is this conversation.",
      "Big ideas before lunch. Deal?",
      "Your brain's warmed up. Let's sprint.",
    ],
  },
  {
    label: "Early Afternoon",
    startHour: 12,
    endHour: 15,
    messages: [
      "Post-lunch slump? I'll be your second wind.",
      "Half the day's still yours. Use it well.",
      "Where were we, {username}?",
      "Fueled up? Let's turn lunch into launch.",
      "Second half. New playbook.",
    ],
  },
  {
    label: "Late Afternoon",
    startHour: 15,
    endHour: 18,
    messages: [
      "The golden hour of productivity - don't blink.",
      "Almost evening, {username}. Finish strong.",
      "One more great idea before sunset.",
      "Wrap the day with a win.",
    ],
  },
  {
    label: "Evening",
    startHour: 18,
    endHour: 21,
    messages: [
      "Day mode off. Think mode on.",
      "The evening belongs to the curious.",
      "Side-project o'clock.",
      "Meetings are over. The thinking isn't.",
    ],
  },
  {
    label: "Night",
    startHour: 21,
    endHour: 24,
    messages: [
      "Late-night thoughts hit different. Let's explore them.",
      "Lights low. Ideas loud.",
      "Tomorrow starts tonight.",
    ],
  },
];

export const dayGreetings: DayGreetingSlot[] = [
  {
    label: "Monday",
    days: [1],
    messages: [
      "New week, {username}. Let's set the tone.",
      "Fresh week. Clean slate. Big swings.",
    ],
  },
  {
    label: "Friday",
    days: [5],
    messages: [
      "It's Friday. Let's finish the week with something great.",
      "Friday energy. Let's ship something.",
    ],
  },
  {
    label: "Weekend",
    days: [0, 6],
    messages: [
      "No meetings, no deadlines - just us and your ideas.",
      "No standups. Just standout ideas.",
    ],
  },
];

export interface SubheadingCategory {
  label: string;
  messages: string[];
}

export const subheadings: SubheadingCategory[] = [
  {
    label: "Memory & Context",
    messages: [
      "Finally, an AI that remembers what matters.",
      "No more re-explaining yourself. Ever.",
      "Context that carries forward, not conversations that start over.",
      "Your AI knows where you left off.",
      "Memory that makes every session smarter than the last.",
    ],
  },
  ...(PINS_ENABLED ? [{
    label: "Pins & Insights",
    messages: [
      "Pin what matters. Surface it when it counts.",
      "Your most important insights, always one click away.",
      "Stop losing great ideas in endless chat history.",
      "Pinned context. Sharper answers.",
      "The things you pin become the things it knows.",
    ],
  }] : []),
  {
    label: "Workflows & Productivity",
    messages: [
      "Build workflows that think alongside you.",
      "Less setup. More output. Every single time.",
      "Your processes, supercharged with AI that adapts.",
      "Automate the repetitive. Focus on the remarkable.",
      "From scattered tasks to seamless workflows.",
    ],
  },
  {
    label: "Personas & Tailoring",
    messages: [
      "One AI. Infinite personalities. All yours.",
      "Tailor your AI like you tailor your team.",
      "The right persona for every problem you face.",
      "Switch roles. Switch context. Never lose focus.",
      "Your AI wears the hat the job needs.",
    ],
  },
  {
    label: "Model-to-Model / Multi-AI",
    messages: [
      "Models talking to models so you don't have to.",
      "Chain intelligence. Multiply results.",
      "When one AI isn't enough, orchestrate many.",
      "Multi-model conversations. Single coherent outcome.",
      "The smartest room in the building has no humans in it.",
    ],
  },
  {
    label: "Killing AI Amnesia",
    messages: [
      "Goodbye AI amnesia. Hello continuity.",
      "Your AI doesn't forget. Neither should yours.",
      "Every conversation builds on the last.",
      "Long-term memory for short-term problems.",
      "An AI that grows with you, not just talks at you.",
    ],
  },
  {
    label: "Big Picture / Positioning",
    messages: [
      "Intelligence that compounds over time.",
      "Not just smarter answers - a smarter system.",
      "The operating system for your thinking.",
      "Where context lives and great work begins.",
      "Stop starting from zero. Start from everything.",
    ],
  },
];

/** On a day with its own greetings, the chance one of those is shown instead of the time-of-day one. */
export const DAY_GREETING_CHANCE = 0.4;

/** Used only if no time slot covers the hour (the slots above cover all 24). */
export const FALLBACK_GREETING = "What would you like to explore today, {username}?";

/**
 * Fills the {username} placeholder in a greeting template. With no name the placeholder and its
 * leading comma are dropped ("Where were we, {username}?" → "Where were we?"), never a stand-in word.
 */
export function fillGreeting(message: string, username: string): string {
  const name = username.trim();
  return name
    ? message.replace(/\{username\}/g, name)
    : message.replace(/,?\s*\{username\}/g, "");
}

/**
 * Splits a greeting into at most two halves of whole sentences (a spaced " - " also ends a clause), so a
 * greeting that has to wrap breaks between sentences, never mid-sentence: "The world's asleep. You're
 * not." / "Let's make something." The split is the one that balances the halves' lengths best (ties go
 * to the longer first line). Each half is a list of its sentences; a one-sentence greeting is one half.
 */
export function splitGreeting(text: string): string[][] {
  const sentences = text.trim().split(/(?<=[.?!]|\s-)\s+/);
  if (sentences.length < 2) return [sentences];

  let split = 1;
  let bestDiff = Infinity;
  for (let k = 1; k < sentences.length; k++) {
    const left = sentences.slice(0, k).join(" ").length;
    const right = sentences.slice(k).join(" ").length;
    const diff = Math.abs(left - right);
    if (diff < bestDiff || (diff === bestDiff && left > right)) {
      split = k;
      bestDiff = diff;
    }
  }
  return [sentences.slice(0, split), sentences.slice(split)];
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getGreeting(username: string, now: Date = new Date()): string {
  return fillGreeting(pickGreeting(now), username);
}

/**
 * Picks a greeting template for this moment, with {username} still unfilled. Lets the landing page
 * pick once and fill in the name whenever it arrives, instead of re-picking (and re-animating).
 */
export function pickGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  const day = now.getDay();

  const daySlot = dayGreetings.find((s) => s.days.includes(day));
  const timeSlot = timeGreetings.find(
    (s) => hour >= s.startHour && hour < s.endHour,
  );

  let message: string;

  if (daySlot && timeSlot) {
    message =
      Math.random() < DAY_GREETING_CHANCE
        ? pickRandom(daySlot.messages)
        : pickRandom(timeSlot.messages);
  } else if (daySlot) {
    message = pickRandom(daySlot.messages);
  } else if (timeSlot) {
    message = pickRandom(timeSlot.messages);
  } else {
    message = FALLBACK_GREETING;
  }

  return message;
}

export function getSubheading(): string {
  const all = subheadings.flatMap((c) => c.messages);
  return pickRandom(all);
}
