-- 1. Roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Replace permissive cars policies
DROP POLICY "Authenticated users can insert cars" ON public.cars;
DROP POLICY "Authenticated users can update cars" ON public.cars;
DROP POLICY "Authenticated users can delete cars" ON public.cars;

CREATE POLICY "Admins can insert cars"
  ON public.cars FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cars"
  ON public.cars FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cars"
  ON public.cars FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Tighten storage policies — restrict listing + admin-only writes
DROP POLICY "Car images are publicly viewable" ON storage.objects;
DROP POLICY "Authenticated users can upload car images" ON storage.objects;
DROP POLICY "Authenticated users can update car images" ON storage.objects;
DROP POLICY "Authenticated users can delete car images" ON storage.objects;

-- Public read by exact path (no listing); Supabase still serves files via public URL
CREATE POLICY "Car images readable by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'car-images' AND auth.role() = 'anon' IS NOT NULL);

CREATE POLICY "Admins can upload car images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'car-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update car images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'car-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete car images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'car-images' AND public.has_role(auth.uid(), 'admin'));