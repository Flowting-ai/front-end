'use client';

import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div key={step} className="flex items-center w-full">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                  isActive ? 'bg-primary border-primary text-primary-foreground' :
                  isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                  'bg-card border-border text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span className="font-bold">{stepNumber}</span>
                )}
              </div>
              <p className="text-sm mt-2 text-center">{step}</p>
            </div>
            {stepNumber < steps.length && (
              <div className={cn(
                'flex-1 h-0.5 mx-4',
                isCompleted ? 'bg-primary' : 'bg-border'
              )}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
