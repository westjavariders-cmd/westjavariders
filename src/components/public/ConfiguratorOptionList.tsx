import { cn } from "@/lib/utils";

/** Choice row the configurator already builds (manual options or catalogue map). */
export type ConfiguratorChoice = {
  id: string;
  internal_value: string;
  customer_label: string | null;
  description?: string | null;
};

type ConfiguratorOptionListProps = {
  options: ConfiguratorChoice[];
  multiple: boolean;
  /** Current answer: one internal_value, or several for multi_select. */
  value: string | string[];
  disabled?: boolean;
  error?: boolean;
  errorId?: string | undefined;
  labelledBy?: string | undefined;
  /** Parent keeps the existing set()/array toggle; this only reports the tap. */
  onSelect: (internalValue: string) => void;
};

function isSelected(value: string | string[], internalValue: string): boolean {
  return Array.isArray(value) ? value.includes(internalValue) : value === internalValue;
}

/**
 * Visual option list for single_select / multi_select. Selection, disabled and
 * answers stay in ConfiguratorForm.
 */
export function ConfiguratorOptionList({
  options,
  multiple,
  value,
  disabled = false,
  error = false,
  errorId,
  labelledBy,
  onSelect,
}: ConfiguratorOptionListProps) {
  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby={labelledBy}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-disabled={disabled || undefined}
      className="divide-y divide-border border-y border-border"
    >
      {options.map((option) => {
        const selected = isSelected(value, option.internal_value);
        const label = option.customer_label?.trim() ?? "";
        const description = option.description?.trim() ?? "";
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(option.internal_value)}
            className={cn(
              "flex min-h-12 w-full items-start gap-3 px-0 py-3.5 text-left",
              "transition-colors duration-150 ease-out motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
              error && !selected && "text-destructive",
            )}
          >
            <span className="min-w-0 flex-1">
              {label ? (
                <span className="block text-sm font-medium leading-snug text-foreground">{label}</span>
              ) : null}
              {description ? (
                <span className="mt-1 block text-sm font-normal leading-relaxed text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-content-center border",
                multiple ? "rounded-sm" : "rounded-full",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/40 bg-transparent",
              )}
            >
              {selected && multiple ? (
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              {selected && !multiple ? (
                <span className="size-2 rounded-full bg-background" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
