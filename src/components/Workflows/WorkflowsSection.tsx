import Image from "next/image";

export default function WorkflowsSection() {
  return (
    <section className="w-full h-auto mt-10 mb-10 lg:mt-40 lg:mb-10">
      <div className="relative max-w-7xl mx-auto text-center flex flex-col items-center px-4">
        <div className="relative lg:absolute flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
              Build workflows that run on AI.
            </h3>
          </div>
          <p className="font-normal text-sm lg:text-base">
            Connect your docs, chats, and personas into repeatable workflows.{" "}
            <br /> Set it up once, run it anytime. No code needed.
          </p>
        </div>

        {/* Build Workflows */}
        <div className="w-full flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <Image
              src="./workflows/buildWorkflows.svg"
              alt="Build Workflows"
              width={16}
              height={16}
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
