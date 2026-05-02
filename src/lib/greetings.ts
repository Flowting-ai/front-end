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
    ],
  },
  {
    label: "Early Morning",
    startHour: 5,
    endHour: 9,
    messages: [
      "Rise and grind, {username}. I've been waiting.",
      "Fresh morning, fresh ideas — let's go.",
      "The day is a blank canvas, {username}. Let's paint.",
    ],
  },
  {
    label: "Late Morning",
    startHour: 9,
    endHour: 12,
    messages: [
      "Peak brain hours, {username}. Let's not waste them.",
      "The morning is still young and so is this conversation.",
    ],
  },
  {
    label: "Early Afternoon",
    startHour: 12,
    endHour: 15,
    messages: [
      "Post-lunch slump? I'll be your second wind.",
      "Half the day's still yours, {username}. Use it well.",
    ],
  },
  {
    label: "Late Afternoon",
    startHour: 15,
    endHour: 18,
    messages: [
      "The golden hour of productivity — don't blink.",
      "Almost evening, {username}. Finish strong.",
    ],
  },
  {
    label: "Evening",
    startHour: 18,
    endHour: 21,
    messages: [
      "Day mode off. Think mode on.",
      "The evening belongs to the curious, {username}.",
    ],
  },
  {
    label: "Night",
    startHour: 21,
    endHour: 24,
    messages: [
      "The night shift starts now, {username}.",
      "Late-night thoughts hit different. Let's explore them.",
    ],
  },
];

export const dayGreetings: DayGreetingSlot[] = [
  {
    label: "Monday",
    days: [1],
    messages: ["New week, {username}. Let's set the tone."],
  },
  {
    label: "Friday",
    days: [5],
    messages: ["It's Friday. Let's finish the week with something great."],
  },
  {
    label: "Weekend",
    days: [0, 6],
    messages: ["No meetings, no deadlines — just us and your ideas."],
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
  {
    label: "Pins & Insights",
    messages: [
      "Pin what matters. Surface it when it counts.",
      "Your most important insights, always one click away.",
      "Stop losing great ideas in endless chat history.",
      "Pinned context. Sharper answers.",
      "The things you pin become the things it knows.",
    ],
  },
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
      "Not just smarter answers — a smarter system.",
      "The operating system for your thinking.",
      "Where context lives and great work begins.",
      "Stop starting from zero. Start from everything.",
    ],
  },
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getGreeting(username: string, now: Date = new Date()): string {
  const hour = now.getHours();
  const day = now.getDay();

  const daySlot = dayGreetings.find((s) => s.days.includes(day));
  const timeSlot = timeGreetings.find(
    (s) => hour >= s.startHour && hour < s.endHour,
  );

  let message: string;

  if (daySlot && timeSlot) {
    message =
      Math.random() < 0.4
        ? pickRandom(daySlot.messages)
        : pickRandom(timeSlot.messages);
  } else if (daySlot) {
    message = pickRandom(daySlot.messages);
  } else if (timeSlot) {
    message = pickRandom(timeSlot.messages);
  } else {
    message = "What would you like to explore today, {username}?";
  }

  return message.replace(/\{username\}/g, username);
}

export function getSubheading(): string {
  const all = subheadings.flatMap((c) => c.messages);
  return pickRandom(all);
}
