import Image from "next/image";

export default function YourContextSection() {
  return (
    <section className="w-full h-auto py-10 lg:py-40">
      <div className="max-w-7xl mx-auto text-center flex flex-col items-center gap-4 lg:gap-10 px-4 lg:px-0">
        {/* Title - large Screen */}
        <div className="hidden lg:flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
              &quot;Your context, always with you.&quot;
            </h3>
          </div>
          <p className="font-normal text-sm lg:text-base">
            Your thinking stays connected across every model and conversation
          </p>
        </div>

        <div className="relative w-full h-auto">
          {/* Title - Smaller Screens */}
          <div className="lg:hidden absolute top-0 w-full left-1/2 -translate-x-1/2 flex flex-col gap-2">
            <div className="text-transparent bg-clip-text bg-black">
              <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
                &quot;Your context, always with you.&quot;
              </h3>
            </div>
            <p className="font-normal text-sm lg:text-base">
              Your thinking stays connected across every model and conversation
            </p>
          </div>

          {/* Content */}
          <div className="translate-y-10 scale-46 sm:scale-50 md:scale-75 lg:scale-100 relative w-full min-h-42 lg:min-h-96 flex items-center justify-center">
            {/* Background */}
            <div className="w-100 max-w-100 h-100 max-h-100 bg-linear-to-b from-amber-100/50 via-amber-100 to-blue-300/60 blur-[60px]"></div>
            {/* <Image
            src="./yourContext/background.svg"
            alt="Your Context Background"
            width={16}
            height={16}
            className="blur-[60px] -translate-y-10 w-full! max-w-[521px] h-auto! object-contain"
          /> */}
            {/* Window */}
            <Image
              src="./yourContext/window.svg"
              alt="Window"
              width={16}
              height={16}
              className="z-1 absolute top-1/2 left-1/2 -translate-1/2 w-full! max-w-[200px] h-auto! object-contain"
            />
            {/* Border + Claude */}
            <div className="z-2 top-10 -translate-x-40 absolute flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src="./yourContext/borderFrame.svg"
                  alt="Border Frame"
                  width={16}
                  height={16}
                  className="w-full max-w-[125px] h-full max-h-[125px] object-contain"
                />
                <Image
                  src="./yourContext/claude.svg"
                  alt="claude"
                  width={16}
                  height={16}
                  className="absolute w-auto h-auto object-contain"
                />
              </div>
            </div>
            {/* Border + Persona */}
            <div className="z-2 bottom-30 -translate-x-74 absolute flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src="./yourContext/borderFrame.svg"
                  alt="Border Frame"
                  width={16}
                  height={16}
                  className="w-full max-w-[125px] h-full max-h-[125px] object-contain"
                />
                <Image
                  src="./yourContext/persona.svg"
                  alt="persona"
                  width={16}
                  height={16}
                  className="absolute w-auto h-auto object-contain"
                />
              </div>
            </div>

            {/* OpenAI */}
            <Image
              src="./yourContext/openai.svg"
              alt="openai"
              width={16}
              height={16}
              className="z-4 absolute bottom-20 -translate-x-52 w-16.5 h-16.5 object-contain backdrop-blur-sm"
            />

            {/* Pins */}
            <Image
              src="./yourContext/pins.svg"
              alt="pins"
              width={16}
              height={16}
              className="z-4 absolute top-39 translate-x-39 w-13.25 h-auto object-contain backdrop-blur-sm"
            />

            {/* Cursor Pointer */}
            <Image
              src="./yourContext/cursorPointer.svg"
              alt="Cursor Pointer"
              width={16}
              height={16}
              className="z-4 absolute bottom-38 translate-x-61.5 w-23.5 h-23.5 object-contain backdrop-blur-sm"
            />

            {/* Connector1 */}
            <Image
              src="./yourContext/connector1.svg"
              alt="connector1"
              width={16}
              height={16}
              className="z-3 absolute top-26 translate-x-4 w-57 h-auto object-contain"
            />

            {/* Connector2 */}
            <Image
              src="./yourContext/connector2.svg"
              alt="connector2"
              width={16}
              height={16}
              className="scale-120 md:scale-110 lg:scale-100 z-3 absolute bottom-28 translate-x-3 w-93.75 h-auto object-contain"
            />

            {/* Dots - Connector 1 */}
            {/* Dot 1 */}
            <div className="z-4 absolute top-25 -translate-x-24 w-2 h-2 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
            {/* Dot 2 */}
            <div className="z-4 absolute top-26 -translate-x-12 w-3 h-3 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
            {/* Dot 3 */}
            <div className="z-4 absolute top-38 translate-x-12 w-2.5 h-2.5 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
            {/* Dot 3 */}
            <div className="z-4 absolute top-42 translate-x-32 w-2 h-2 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>

             {/* Dots - Connector 2 */}
            {/* Dot 1 */}
            <div className="z-4 absolute bottom-27 -translate-x-44 w-2 h-2 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
            {/* Dot 2 */}
            <div className="z-4 absolute bottom-36 translate-x-0 w-4 h-4 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
            {/* Dot 3 */}
            <div className="z-4 absolute bottom-49 translate-x-50 w-2 h-2 bg-white drop-shadow-sm drop-shadow-white rounded-full"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
