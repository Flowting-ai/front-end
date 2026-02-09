import AutoManualSection from "@/components/AutoManual/AutoManualSection";
import FeaturesSection from "@/components/Features/FeaturesSection";
import FlowtingSelectSection from "@/components/Flowting/FlowtingSelectSection";
import Footer from "@/components/Footer/Footer";
import GoBuildSomething from "@/components/GoBuildSomething/GoBuildSomething";
import HeroSection from "@/components/Hero/HeroSection";
import PersonasSection from "@/components/Personas/PersonasSection";
import ProblemsSection from "@/components/Problems/ProblemsSection";
import QuoteFlowting from "@/components/QuoteFlowting/QuoteFlowting";
import WorkflowsSection from "@/components/Workflows/WorkflowsSection";
import YourContextSection from "@/components/YourContext/YourContextSection";
import Image from "next/image";

export default function Home() {
  return (
    <>
      <HeroSection/>
      <ProblemsSection/>
      <FlowtingSelectSection/>
      <AutoManualSection/>
      <YourContextSection/>
      <FeaturesSection/>
      <PersonasSection/>
      <WorkflowsSection/>
      <QuoteFlowting/>
      <GoBuildSomething/>
      <Footer/> 
    </>
  );
}


{/* <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a> */}
