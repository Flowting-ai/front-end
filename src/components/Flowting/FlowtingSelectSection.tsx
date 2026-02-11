'use client';
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const AIModels = [
  { name: "Grok", id: "grok", color: "from-purple-600 to-purple-800" },
  { name: "ChatGPT", id: "chatgpt", color: "from-green-600 to-green-800" },
  { name: "Claude", id: "claude", color: "from-blue-600 to-blue-800" },
  { name: "Gemini", id: "gemini", color: "from-red-600 to-red-800" },
  { name: "Meta", id: "meta", color: "from-orange-600 to-orange-800" },
  { name: "DeepSeek", id: "deepseek", color: "from-pink-600 to-pink-800" },
  { name: "Qwen", id: "qwen", color: "from-cyan-600 to-cyan-800" },
];

const sampleQueries = [
  "Create a product mockup image",
  "Latest findings on mRNA vaccines",
  "Write a python script for this csv",
  "Debug this React component",
  "Explain quantum computing",
  "Design a database schema",
  "Summarize this research paper",
];

export default function FlowtingSelectSection() {


  return (
    <section className="w-full h-auto mt-10 lg:mt-40">
      {/* Initial Content */}
      <div className="max-w-7xl mx-auto text-left flex flex-col gap-4 px-4 lg:px-0">
        <div className="flex flex-col gap-2">
          <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
            Flowting selects the best model <br /> for your question
          </h3>
          <p className="font-normal text-sm lg:text-base">
            No more guessing. No more switching. Just ask.
          </p>
        </div>
        <Image
          src="./flowtingSelect/select-desktop.svg"
          alt="Flowting Selection Desktop"
          width={16}
          height={16}
          className="hidden lg:block w-full! h-auto! object-contain rounded-3xl"
        />
        <Image
          src="./flowtingSelect/select-mobile.svg"
          alt="Flowting Selection Mobile"
          width={16}
          height={16}
          className="lg:hidden block w-full! h-auto! object-contain rounded-3xl"
        />
      </div>
    </section>
  );
}
