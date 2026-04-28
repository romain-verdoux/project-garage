-- Enums matching the existing Car type
CREATE TYPE public.car_type AS ENUM ('Coupé', 'Sedan', 'Cabriolet', 'Wagon', 'Hatchback');
CREATE TYPE public.car_decade AS ENUM ('20s', '10s', '00s', '90s', '80s', '70s', '60s', '50s');
CREATE TYPE public.car_difficulty AS ENUM ('easy', 'medium', 'hard', 'extreme');
CREATE TYPE public.car_cost_level AS ENUM ('low', 'medium', 'high', 'extreme');

-- Cars table
CREATE TABLE public.cars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_url TEXT,
  type public.car_type NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  decade public.car_decade NOT NULL,
  history TEXT NOT NULL DEFAULT '',
  difficulty_stars SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty_stars BETWEEN 1 AND 5),
  parts_to_find public.car_difficulty NOT NULL DEFAULT 'medium',
  cost_of_parts public.car_cost_level NOT NULL DEFAULT 'medium',
  reliability_stars SMALLINT NOT NULL DEFAULT 3 CHECK (reliability_stars BETWEEN 1 AND 5),
  mechanical_difficulty public.car_difficulty NOT NULL DEFAULT 'medium',
  electronic_difficulty public.car_difficulty NOT NULL DEFAULT 'medium',
  known_defects TEXT[] NOT NULL DEFAULT '{}',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cars_slug ON public.cars(slug);
CREATE INDEX idx_cars_decade ON public.cars(decade);
CREATE INDEX idx_cars_type ON public.cars(type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cars_updated_at
BEFORE UPDATE ON public.cars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cars are viewable by everyone"
  ON public.cars FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert cars"
  ON public.cars FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cars"
  ON public.cars FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete cars"
  ON public.cars FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket for car images
INSERT INTO storage.buckets (id, name, public) VALUES ('car-images', 'car-images', true);

CREATE POLICY "Car images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'car-images');

CREATE POLICY "Authenticated users can upload car images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'car-images');

CREATE POLICY "Authenticated users can update car images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'car-images');

CREATE POLICY "Authenticated users can delete car images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'car-images');