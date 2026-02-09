import PixelCard from "@/animations/PixelCard";
import Image from "next/image";

export default function ProblemCard({
  problem,
  description,
  solution,
  imgSrc,
}) {
  return (
    <PixelCard
      variant="pink"
      className="w-full h-60! lg:h-[400px]! min-w-60 max-w-87.5  group hover:animate-dual-beam2 hover:animate-border-rotate2 border-3! border-white shadow-sm transition-all duration-500"
    >
      <div className="absolute w-full h-full bg-transparent rounded-xl">
        <div className="relative w-full h-full bg-linear-to-b from-blue-200/70 via-65% via-amber-200/50 to-blue-200/50 rounded-xl flex flex-col justify-between px-0 py-11 transition-all duration-500">
          {/* Image */}
          <Image
            src={imgSrc}
            alt={problem}
            fill
            className="group-hover:scale-120 z-1 absolute w-full h-auto opacity-10 object-cover transition-all duration-300"
          />

          {/* Content */}
          <div className="z-2 group-hover:translate-y-2 flex flex-col gap-2 transition-all duration-300">
            <h3 className="z-2 font-medium text-[20px] lg:text-[24px] text-transparent bg-clip-text bg-linear-to-b from-zinc-950 via-zinc-600 to-zinc-950 ">
              {problem}
            </h3>
            <h3 className="z-2 font-normal text-sm lg:text-base text-zinc-500 group-hover:backdrop-blur-[2px] px-6">
              {description}
            </h3>
          </div>
          <h3 className="z-2 group-hover:-translate-y-2 font-light text-sm lg:text-base transition-all duration-300">
            {solution}
          </h3>
        </div>
      </div>
    </PixelCard>
  );
}
