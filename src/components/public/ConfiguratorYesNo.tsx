import { cn } from "@/lib/utils";

type ConfiguratorYesNoProps = {
  value: boolean;
  disabled?: boolean;
  error?: boolean;
  errorId?: string | undefined;
  labelledBy?: string | undefined;
  onChange: (value: boolean) => void;
};

/**
 * Visual Yes/No pair for boolean fields. The parent still stores a boolean
 * via set(); this only presents the two choices.
 */
export function ConfiguratorYesNo({
  value,
  disabled = false,
  error = false,
  errorId,
  labelledBy,
  onChange,
}: ConfiguratorYesNoProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-disabled={disabled || undefined}
      className="grid grid-cols-2 gap-2 sm:gap-3"
    >
      {(
        [
          { on: true, label: "Yes" },
          { on: false, label: "No" },
        ] as const
      ).map((choice) => {
        const selected = value === choice.on;
        return (
          <button
            key={choice.label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(choice.on)}
            className={cn(
              "flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border px-4 py-4",
              "text-sm tracking-wide sm:min-h-16",
              "transition-colors duration-150 ease-out",
              "motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-foreground bg-muted/60 font-semibold shadow-sm"
                : "border-border bg-background font-medium hover:border-foreground/35 hover:bg-muted/30",
              disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-background",
              error && !selected && "border-destructive/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-5 shrink-0 place-content-center rounded-full border",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/40 bg-background",
              )}
            >
              {selected ? <span className="size-2 rounded-full bg-background" /> : null}
            </span>
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
