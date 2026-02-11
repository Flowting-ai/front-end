import Image from "next/image";

export default function AutoManualSection() {
  return (
    <section className="w-full h-auto my-10 lg:my-40">
      <div className="max-w-7xl mx-auto text-left flex flex-col gap-4 px-4 lg:px-0">
        <div className="flex flex-col gap-2">
          <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground">
            Auto or manual. You choose <br /> without losing context 
          </h3>
          {/* <p className="font-normal text-base">
            No more guessing. No more switching. Just ask.
          </p> */}
        </div>
        <Image
              src="./autoManual/autoManual.svg"
              alt="Auto Manual Selection"
              width={16}
              height={16}
              className="w-full! h-auto! object-contain"
            />
      </div>
    </section>
  );
}
