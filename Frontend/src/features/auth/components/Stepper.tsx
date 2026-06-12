import { cn } from "@/shared/lib/utils/cn";

interface Step {
  label: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-start justify-center gap-0">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isDone = index < currentStep;
        const isUpcoming = index > currentStep;

        return (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                  isActive &&
                    "bg-accent text-white shadow-lg shadow-accent/30 ring-2 ring-accent/20",
                  isDone && "bg-accent text-white",
                  isUpcoming && "bg-gray-100 text-text-secondary",
                )}
              >
                {isDone ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="text-white"
                  >
                    <path
                      d="M2 7.5L5.5 11L12 3"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-center text-xs font-cairo leading-tight transition-colors duration-300",
                  (isActive || isDone) && "text-text-primary font-semibold",
                  isUpcoming && "text-text-secondary",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 mt-[-1.5rem] h-[3px] flex-1 rounded-full self-center",
                  index < currentStep ? "bg-accent" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
