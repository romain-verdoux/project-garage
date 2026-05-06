
-- Add make column
ALTER TABLE public.cars ADD COLUMN make text NOT NULL DEFAULT '';

-- Backfill make from the first word of the name
UPDATE public.cars SET make = split_part(name, ' ', 1) WHERE make = '';
