import { cn } from "@/lib/utils";

type ConfiguratorYesNoProps = {
  /** true = Yes, false = No, undefined = unanswered. Parent owns the answer. */
  value: boolean | undefined;
  disabled?: boolean;
  error?: boolean;
  errorId?: string | undefined;
  labelledBy?: string | undefined;
  onSelect: (value: boolean) => void;
};

function Choice({
  label,
  selected,
  disabled,
  error,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  error: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 border px-3 text-sm font-medium",
        "transition-colors duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-transparent text-foreground hover:border-foreground/50",
        error && !selected && "border-destructive/50",
        disabled && "cursor-not-allowed opacity-50 hover:border-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 shrink-0 place-content-center rounded-full border",
          selected ? "border-background bg-background" : "border-muted-foreground/40 bg-transparent",
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-foreground" /> : null}
      </span>
      {label}
    </button>
  );
}

/**
 * Yes / No presentation for boolean fields. Answers stay in ConfiguratorForm.
 */
export function ConfiguratorYesNo({
  value,
  disabled = false,
  error = false,
  errorId,
  labelledBy,
  onSelect,
}: ConfiguratorYesNoProps) {
  const yesSelected = value === true;
  const noSelected = value === false;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-disabled={disabled || undefined}
      className="grid grid-cols-2 gap-3"
    >
      <Choice
        label="Yes"
        selected={yesSelected}
        disabled={disabled}
        error={error}
        onSelect={() => onSelect(true)}
      />
      <Choice
        label="No"
        selected={noSelected}
        disabled={disabled}
        error={error}
        onSelect={() => onSelect(false)}
      />
    </div>
  );
}
