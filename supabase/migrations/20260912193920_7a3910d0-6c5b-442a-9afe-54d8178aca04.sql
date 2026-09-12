ALTER TABLE public.transports
  ADD COLUMN IF NOT EXISTS calc_mode text NOT NULL DEFAULT 'sum';

ALTER TABLE public.transports
  ADD CONSTRAINT transports_calc_mode_check CHECK (calc_mode IN ('sum', 'multiply'));