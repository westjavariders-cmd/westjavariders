import { cn } from "@/lib/utils";

type ConfiguratorQuantityStepperProps = {
  choices: number[];
  value: string;
  disabled?: boolean;
  error?: boolean;
  errorId?: string;
  labelledBy?: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: string) => void;
};

/**
 * Discrete quantity control for catalogue people / travel-time choices.
 * Only the values supplied by the catalogue can be selected.
 */
export function ConfiguratorQuantityStepper({
  choices,
  value,
  disabled = false,
  error = false,
  errorId,
  labelledBy,
  decreaseLabel,
  increaseLabel,
  onChange,
}: ConfiguratorQuantityStepperProps) {
  const values = [...new Set(choices.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  const index = values.findIndex((n) => String(n) === value);
  const current = index >= 0 ? values[index] : null;
  const canDecrease = !disabled && index > 0;
  const canIncrease = !disabled && values.length > 0 && index < values.length - 1;

  function step(nextIndex: number) {
    const next = values[nextIndex];
    if (next == null) return;
    onChange(String(next));
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-disabled={disabled || undefined}
      className="flex items-center gap-4"
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={!canDecrease}
        onClick={() => step(index - 1)}
        className={cn(
          "grid size-12 shrink-0 place-content-center border text-lg leading-none",
          "transition-colors duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          canDecrease
            ? "border-border text-foreground hover:border-foreground/50"
            : "cursor-not-allowed border-border text-muted-foreground/40",
          error && "border-destructive/50",
        )}
      >
        −
      </button>
      <p
        aria-live="polite"
        className={cn(
          "min-w-[4.5rem] text-center text-3xl font-medium tracking-tight",
          current == null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {current ?? "—"}
      </p>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={!canIncrease}
        onClick={() => step(index < 0 ? 0 : index + 1)}
        className={cn(
          "grid size-12 shrink-0 place-content-center border text-lg leading-none",
          "transition-colors duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          canIncrease
            ? "border-border text-foreground hover:border-foreground/50"
            : "cursor-not-allowed border-border text-muted-foreground/40",
          error && "border-destructive/50",
        )}
      >
        +
      </button>
    </div>
  );
}
