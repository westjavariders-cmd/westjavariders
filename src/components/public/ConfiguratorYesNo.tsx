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
  emphasize,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  error: boolean;
  emphasize: boolean;
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
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium",
        "transition-colors duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        emphasize && !selected && "border-foreground/30 bg-muted/40 hover:bg-muted/55",
        emphasize && selected && "border-foreground bg-muted",
        !emphasize && !selected && "border-border bg-background hover:border-foreground/25 hover:bg-muted/20",
        !emphasize && selected && "border-foreground/55 bg-muted/30",
        error && !selected && "border-destructive/50",
        disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-background",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 shrink-0 place-content-center rounded-full border",
          selected ? "border-foreground bg-foreground" : "border-muted-foreground/35 bg-background",
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-background" /> : null}
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
      className="grid grid-cols-2 gap-2"
    >
      <Choice
        label="Yes"
        selected={yesSelected}
        disabled={disabled}
        error={error}
        emphasize
        onSelect={() => onSelect(true)}
      />
      <Choice
        label="No"
        selected={noSelected}
        disabled={disabled}
        error={error}
        emphasize={false}
        onSelect={() => onSelect(false)}
      />
    </div>
  );
}
