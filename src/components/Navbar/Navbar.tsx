"use client";
import { ChevronLeft, Moon, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    return saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Memoized theme application function
  const applyTheme = useCallback((newTheme: "light" | "dark") => {
    const root = document.documentElement;

    if (newTheme === "dark") {
      root.setAttribute("data-theme", "dark");
      root.classList.add("dark");
    } else {
      root.removeAttribute("data-theme");
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", newTheme);
  }, []);

  // Sync DOM with theme state (no setState call inside)
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Memoized theme change handler
  const handleThemeChange = useCallback((newTheme: "light" | "dark") => {
    applyTheme(newTheme);
    setTheme(newTheme);
    setIsDropdownOpen(false);
  }, [applyTheme]);

  // Memoized dropdown toggle
  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  return (
    <nav className="w-full h-auto">
      <div className="w-full sm:hidden block font-medium tracking-tight text-center text-lg lg:text-[18px] text-transparent bg-clip-text bg-linear-to-r from-zinc-300 via-zinc-700 to-zinc-300">
        <p>FlowtingAI</p>
      </div>
      <div className="w-full h-12 lg:h-14 bg-nav-bg rounded-2xl shadow-sm shadow-main-border flex items-center justify-between pl-4 pr-2 md:px-5 py-2.5">
        {/* Left - Logo*/}
        <div className="relative w-auto h-full flex items-center gap-4">
          {theme === "light" ? <Image
            src="./hero/FlowtingLogo.svg"
            alt="Flowting AI Logo"
            width={28}
            height={28}
            className="w-6 h-6 lg:w-7 lg:h-7"
          /> : <Image
            src="./hero/FlowtingLogoSilver.svg"
            alt="Flowting AI Logo"
            width={28}
            height={28}
            className="w-6 h-6 lg:w-7 lg:h-7"
          />}
          <p className="hidden sm:block font-normal text-sm md:text-base text-foreground lg:text-[18px]">
            FlowtingAI
          </p>
        </div>

        {/* Right - Navigation CTAS & Theme Selector */}
        <div className="w-full md:w-auto h-full flex items-center justify-end gap-2 md:gap-4">
          {/* Theme Selector Dropdown */}
          <div className="hidden relative">
            <button
              onClick={toggleDropdown}
              className="cursor-pointer flex items-center gap-2 text-xs md:text-sm lg:text-base text-foreground bg-main-bg border border-main-border rounded-xl shadow-sm hover:scale- px-3 py-2 transition-all duration-300"
              aria-label="Toggle theme"
              aria-expanded={isDropdownOpen}
              title={`Current theme: ${theme}`}
            >
              {theme === "light" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{theme === "light" ? "Light" : "Dark"}</span>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-background border border-main-border rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`cursor-pointer w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition-colors ${
                    theme === "light"
                      ? "bg-main-bg text-foreground font-medium"
                      : "text-foreground hover:bg-main-bg"
                  }`}
                  type="button"
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`cursor-pointer w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition-colors ${
                    theme === "dark"
                      ? "bg-main-bg text-foreground font-medium"
                      : "text-foreground hover:bg-main-bg"
                  }`}
                  type="button"
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
              </div>
            )}
          </div>

          <a
            href="https://front-end-beta-puce.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs md:text-sm lg:text-base text-foreground bg-main-bg border border-main-border rounded-xl shadow-sm shadow-zinc-00 px-4 py-2 hover:scale-95 transition-all duration-300"
          >
            Sign In
          </a>
          {pathname === "/" ? (
            <Link
              href={"/contact"}
              className="text-xs md:text-sm lg:text-base text-background! bg-nav-button-bg border border-[#0A0A0A] rounded-xl px-4 py-2 hover:scale-95 transition-all duration-300"
            >
              Get Started
            </Link>
          ) : pathname === "/contact" ? (
            <Link
              href="/"
              className="text-xs md:text-sm lg:text-base text-foreground! hover:text-black transition-colors px-4 py-2 inline-flex items-center gap-1"
            >
              <ChevronLeft /> Back to Home
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
