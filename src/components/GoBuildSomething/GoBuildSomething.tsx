import Image from "next/image";

export default function GoBuildSomething() {
  return (
    <section className="w-full h-auto mb-10 lg:mb-20">
      <div className="max-w-7xl mx-auto text-center flex flex-col items-center gap-12 lg:gap-24">
        <div className="flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[116%] text-xl lg:text-[37px] text-foreground">
              Go Build Something.
            </h3>
          </div>
          {/* <p className="font-normal text-base">
                    content
                  </p> */}
        </div>

        {/* Flowting Windows */}
        <div className="w-full flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative lg:hidden flex items-center gap-4">
              <Image
                src="./goBuildSomething/window.svg"
                alt="flowting window"
                width={700}
                height={100}
                className="w-full h-auto object-contain"
              />
              {/* qwen */}
              <Image
                src="./goBuildSomething/qwen.svg"
                alt="flowting window qwen"
                width={12}
                height={12}
                className="absolute left-4 top-[70%] object-contain"
              />
              {/* meta */}
              <Image
                src="./goBuildSomething/meta.svg"
                alt="flowting window meta"
                width={15}
                height={15}
                className="absolute left-8 top-[58%] object-contain"
              />
              {/* gemini */}
              <Image
                src="./goBuildSomething/gemini.svg"
                alt="flowting window gemini"
                width={18}
                height={18}
                className="absolute left-13 top-[48%] object-contain"
              />
              {/* grok */}
              <Image
                src="./goBuildSomething/grok.svg"
                alt="flowting window grok"
                width={21}
                height={21}
                className="absolute left-20 top-[38%] object-contain"
              />
              {/* claude */}
              <Image
                src="./goBuildSomething/claude.svg"
                alt="flowting window claude"
                width={24}
                height={24}
                className="absolute left-28 top-[29%] object-contain"
              />
              {/* OpenAI */}
              <Image
                src="./goBuildSomething/openai.svg"
                alt="flowting window openai"
                width={27}
                height={27}
                className="absolute left-38 top-[22%] object-contain"
              />
              {/* Deepseek */}
              {/* <Image
                src="./goBuildSomething/deepseek.svg"
                alt="flowting window deepseek"
                width={30}
                height={30}
                className="absolute left-40 top-[16%] object-contain"
              /> */}
            </div>

            {/* Desktop Windows */}
            <Image
              src="./goBuildSomething/flowtingWindows.svg"
              alt="flowting windows"
              width={700}
              height={100}
              className="hidden lg:block w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
