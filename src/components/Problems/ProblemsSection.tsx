import ProblemCard from "./ProblemCard";
import Problem1 from "./problem1.jpg";
import Problem2 from "./problem2.jpg";
import Problem3 from "./problem3.jpg";
import Problem4 from "./problem4.jpg";

const CARD_CONTENT = [
  {
    id: 1,
    problem: "Choice Paralysis",
    description:
      "You spend more time picking the right model than doing the actual work.",
    solution: "Auto-routing picks for you",
    imgSrc: Problem1,
  },
  {
    id: 2,
    problem: "Scattered Workflow",
    description:
      "You start in ChatGPT, switch to Claude, copy into Notion. Your work lives in five tabs and none of them talk to each other.",
    solution: "One workspace, all models",
    imgSrc: Problem2,
  },
  {
    id: 3,
    problem: "Work Gets Buried",
    description:
      "That perfect prompt from last week? Buried in an old chat you'll never find.",
    solution: "Save, organize, reuse",
    imgSrc: Problem3,
  },
  {
    id: 4,
    problem: "AI Has No Memory",
    description: "New chat, new model, same briefing. Again and again.",
    solution: "Context that stays with you",
    imgSrc: Problem4,
  },
];

export default function ProblemsSection() {
  return (
    <section className="w-full h-auto my-10 lg:my-10 lg:my-40">
      <div className="max-w-7xl mx-auto text-center flex flex-col items-center justify-center gap-4 lg:gap-12 px-4 lg:px-0">
        <h3 className="font-medium lg:font-normal leading-[120%] text-xl lg:text-[37px] text-foreground text-foreground">
          Do these issues sound familiar?
        </h3>
        <div className="w-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Map the problem cards here */}
          {CARD_CONTENT.map(({ id, problem, description, solution, imgSrc }) => (
            <ProblemCard
              key={id}
              problem={problem}
              description={description}
              solution={solution}
              imgSrc={imgSrc}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
