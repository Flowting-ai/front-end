import Image from "next/image";

export default function PersonasSection() {
  return (
    <section className="w-full h-auto my-20 lg:my-40">
      <div className="max-w-7xl mx-auto text-center flex flex-col items-center gap-4 lg:gap-10 px-4 lg:px-0">
        <div className="flex flex-col gap-2">
          <div className="text-transparent bg-clip-text bg-black">
            <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
              Your AI, Your Rules
            </h3>
          </div>
          <p className="font-normal text-sm lg:text-base">
            Create custom personas. Share them with anyone.
          </p>
        </div>

        {/* Personas */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Image
            src="./personas/createPersona.svg"
            alt="Create Persona"
            width={16}
            height={16}
            className="w-full max-w-160  h-auto lg:h-164 max-h-164 bg-white object-contain rounded-3xl shadow-sm"
          />
          <div className="w-full max-w-160   h-auto max-h-164 bg-white rounded-3xl shadow flex items-center justify-center p-4 ">
            <div className="relative w-full h-full bg-linear-to-b from-[#CCEAEF] via-amber-100 to-[#CCEAEF] rounded-2xl overflow-hidden">
              <Image
                src="./personas/persona-skew.svg"
                alt="persona-skew"
                width={500}
                height={500}
                className="w-full object-contain"
              />

              {/* Text */}
              <div className="absolute top-[10%] left-[10%] lg:top-20 lg:left-20 text-left text-[#525252] flex flex-col gap-2">
                <h3 className="text-xl lg:text-[28px]">Share Persona</h3>
                <p className="w-2/3 text-xs lg:text-base leading-[120%]">Share personas across teams so everyone can build with the same agent.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
