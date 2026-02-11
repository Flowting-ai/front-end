import Image from "next/image";
import Link from "next/link";
import {
  FaXTwitter,
  FaInstagram,
  FaDiscord,
  FaLinkedinIn,
} from "react-icons/fa6";

const FOOTER_LINKS_ONE = [
  {
    name: "Features",
    href: "/features",
    disabled: true,
  },
  {
    name: "Pricing",
    href: "/pricing",
    disabled: true,
  },
  {
    name: "Changelog",
    href: "/changelog",
    disabled: true,
  },
  {
    name: "Docs",
    href: "/docs",
    disabled: true,
  },
];
const FOOTER_LINKS_TWO = [
  {
    name: "About",
    href: "/about",
    disabled: true,
  },
  {
    name: "Blog",
    href: "/Blog",
    disabled: true,
  },
  {
    name: "Careers",
    href: "/careers",
    disabled: true,
  },
  {
    name: "Contact",
    href: "/contact",
    disabled: true,
  },
];
const FOOTER_LINKS_SOCIALS = [
  {
    name: "X",
    href: "https://x.com/Flowtingai",
    disabled: false,
    icon: <FaXTwitter />,
  },
  {
    name: "Discord",
    href: "https://discord.gg/eXfnSe86dr",
    disabled: false,
    icon: <FaDiscord />,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/flowting-ai/",
    disabled: false,
    icon: <FaLinkedinIn />,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/flowtingai?igsh=MXJuYXl5bDc2NDk5Zw==",
    disabled: false,
    icon: <FaInstagram />,
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full h-auto mt-10 overflow-hidden">
      {/* SOCIALS */}
      <div className="flex flex-col items-center gap-6 py-12">
        <h3 className="font-normal text-lg lg:text-3xl">Connect With Us</h3>
        <ul className="list-none w-full flex items-center justify-center gap-3 lg:gap-6 flex-wrap px-4">
          {FOOTER_LINKS_SOCIALS.map(({ name, href, disabled, icon }) => (
            <li key={name}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 lg:w-16 lg:h-16 rounded-full border-2 border-zinc-600 text-zinc-600 bg-white transition-all duration-300 hover:bg-black hover:text-white hover:scale-110 active:scale-95"
                title={name}
              >
                <span className="text-lg lg:text-3xl">{icon}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* GRIDS */}
      {/* <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-2 px-4 lg:px-0 py-10">

        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-lg lg:text-xl">Product</h3>
          <ul className="list-none w-full font-normal text-lg lg:text-xl flex flex-col gap-2">
            {FOOTER_LINKS_ONE.map(({ name, href, disabled }) => (
              <li key={name}>
                <Link
                  href={href}
                  className={`${disabled ? "pointer-events-none text-zinc-300" : "text-zinc-500 hover:text-black"} transition-all duration-300`}
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-lg lg:text-xl">Company</h3>
          <ul className="list-none w-full font-normal text-lg lg:text-xl flex flex-col gap-2">
            {FOOTER_LINKS_TWO.map(({ name, href, disabled }) => (
              <li key={name}>
                <Link
                  href={href}
                  className={`${disabled ? "pointer-events-none text-zinc-300" : "text-zinc-500 hover:text-black"} transition-all duration-300`}
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-lg lg:text-xl">Connect</h3>
          <ul className="list-none w-full font-normal text-lg lg:text-xl flex flex-col gap-2">
            {FOOTER_LINKS_SOCIALS.map(({ name, href, disabled }) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${disabled ? "pointer-events-none text-zinc-300" : "text-zinc-500 hover:text-black"} transition-all duration-300`}
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div> */}

      {/* BOTTOM */}
      <div className="relative w-full h-auto text-center lg:text-left px-4 lg:px-0 py-10">
        <div className="max-w-7xl mx-auto text-balance text-sm lg:text-base text-subtext flex flex-col-reverse lg:flex-row gap-4">
          <div className="flex-1">
            <p>&copy; {currentYear} FlowtingAI. Made with context.</p>
            <p>
              ↳ (Yes, an AI helped write this site. But a human approved it.)
            </p>
          </div>

          {/* Flowting AI Logo */}
          <div className="flex-1 lg:flex-0 flex items-center justify-center gap-4">
            <Image
              src="./hero/FlowtingLogoSilver.svg"
              alt="Flowting AI Logo"
              width={43}
              height={43}
              className="w-8 h-8 lg:w-10.75 lg:h-10.75"
            />
            <h3 className="font-normal leading-[120%] text-2xl lg:text-[36px] text-subtext">
              FlowtingAI
            </h3>
          </div>
        </div>
        <div className="-z-1 absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-120 h-120 bg-amber-100/50 rounded-full blur-[60px]"></div>
        <div className="-z-1 absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-120 h-120 bg-amber-100/50 rounded-full blur-[60px]"></div>
        
      </div>
    </footer>
  );
}
