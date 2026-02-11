import Image from "next/image";

export default function QuoteFlowting() {
  return (
    <section className="w-full h-auto mb-10 lg:mb-40 overflow-hidden">
      <div className="max-w-7xl mx-auto text-center bg-linear-to-b flex flex-col items-center gap-10 px-4">
        {/* Title */}
        {/* <div className="flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
              For the ones who utilize AI
            </h3>
          </div>
          <p className="font-normal text-base">
            For the ones who build with AI Researchers, students, founders, and
            teams pushing the boundaries of what&quot;s possible.
            <br /> You deserve tools that keep up with how you think. FlowtingAI
            is the workspace where AI finally works the way you do. <br />
            When AI remembers what matters, it stops making things up.
          </p>
        </div> */}

        {/* Quote Background */}
        <div className="relative w-full flex items-center justify-center">
          <div className="w-full min-h-[80vh] lg:min-h-screen h-full flex items-center justify-center gap-6">
            <div className="absolute w-full h-[70vh] bg-linear-to-b from-blue-200 via-amber-100 to-blue-200 rounded-full blur-3xl"></div>
            <Image
              src="./quoteFlowting/quoteBackground.svg"
              alt="Quote Background"
              width={16}
              height={16}
              className="animate-pulse z-1 absolute lg:static w-120 h-auto object-contain"
            />
            <div className="z-2 w-full max-w-140 text-left flex flex-col gap-3">
              <h4 className="font-semibold text-xl lg:text-3xl text-black">For the ones who utilize AI</h4>
              <ul className="list-none font-normal text-lg lg:text-2xl flex flex-col gap-2">
                <li>Researchers, students, founders,
                and teams pushing the boundaries of what&apos;s possible. You deserve tools that keep up with how you think. </li>                
                <li>FlowtingAI is
                the workspace where AI finally works the way you do.</li>
                <li>When AI remembers what matters, it stops making things up.</li>            
              </ul>
              <div className="w-full flex items-center justify-end">
                <p className="font-medium text-lg lg:text-xl">- Team Flowting</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
