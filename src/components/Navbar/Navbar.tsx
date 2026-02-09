"use client";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  return (
    <div className="w-full h-12 lg:h-14 bg-white rounded-2xl shadow-sm flex items-center justify-between px-5 py-2.5">
      {/* Left - Logo*/}
      <div className="w-auto h-full flex items-center gap-4">
        <Image
          src="/hero/FlowtingLogo.svg"
          alt="Flowting AI Logo"
          width={28}
          height={28}
          className="w-6 h-6 lg:w-7 lg:h-7"
        />
        <p className="font-normal text-base lg:text-[18px]">FlowtingAI</p>
      </div>

      {/* Right - Navigation CTAS */}
      <div className="w-auto h-full flex items-center gap-4">
        {pathname === "/" ? (
          <Link
            href={"/contact"}
            className="text-sm lg:text-base text-white bg-[#0A0A0A] hover:bg-black rounded-xl px-4 py-2 hover:scale-95 transition-all duration-300"
          >
            Get Started
          </Link>
        ) : pathname === "/contact" ? (
          <Link
            href="/"
            className="text-sm lg:text-base text-zinc-600 hover:text-black transition-colors px-4 py-2 inline-flex items-center gap-1"
          >
            <ChevronLeft /> Back to Home
          </Link>
        ) : null}
      </div>
    </div>
  );
}
