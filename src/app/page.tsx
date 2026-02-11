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
      {/* <AutoManualSection/> */}
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
