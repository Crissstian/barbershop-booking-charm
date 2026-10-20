ALTER TABLE public.services ADD COLUMN counts_as_haircut boolean NOT NULL DEFAULT false;
UPDATE public.services SET counts_as_haircut = true WHERE name IN ('Taglio capelli + shampoo','Taglio capelli','Taglio bambino + shampoo','Taglio capelli bambino') AND active;

CREATE TABLE public.recurring_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  barber_id uuid NOT NULL REFERENCES public.barbers(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  interval_weeks integer NOT NULL DEFAULT 1 CHECK (interval_weeks IN (1,2)),
  start_date date NOT NULL,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_appointments TO authenticated;
GRANT ALL ON public.recurring_appointments TO service_role;
ALTER TABLE public.recurring_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all recurring" ON public.recurring_appointments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER recurring_touch BEFORE UPDATE ON public.recurring_appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.appointments ADD COLUMN recurring_id uuid REFERENCES public.recurring_appointments(id);
ALTER TABLE public.appointments ADD COLUMN occurrence_date date;
CREATE UNIQUE INDEX appointments_recurring_occurrence ON public.appointments(recurring_id, occurrence_date) WHERE recurring_id IS NOT NULL;

CREATE TABLE public.recurring_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES public.recurring_appointments(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('skip','materialized')),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_id, occurrence_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_exceptions TO authenticated;
GRANT ALL ON public.recurring_exceptions TO service_role;
ALTER TABLE public.recurring_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all recurring exceptions" ON public.recurring_exceptions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL DEFAULT '',
  name text NOT NULL,
  description text,
  image_url text,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active products" ON public.products FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "admin all products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.products (brand, name, image_url, sort) VALUES
 ('Davines Naturaltech','Energizing Shampoo','/__l5e/assets-v1/197c04cb-7a83-4dd0-825c-04341d09eb2c/davines-naturaltech-energizing-shampoo.jpg',1),
 ('Davines Naturaltech','Nourishing Shampoo','/__l5e/assets-v1/efdc84d3-e203-4755-9911-23446ac08732/davines-naturaltech-nourishing-shampoo.jpg',2),
 ('Davines Naturaltech','Replumping Shampoo','/__l5e/assets-v1/523b3d47-ead5-45d8-9c91-8ed3faf35733/davines-naturaltech-replumping-shampoo.jpg',3),
 ('Davines Naturaltech','Rebalancing Shampoo','/__l5e/assets-v1/851d4a21-7dce-4804-a5e7-780bfc09a043/davines-naturaltech-rebalancing-shampoo.jpg',4),
 ('Davines Naturaltech','Well-Being Shampoo','/__l5e/assets-v1/f1b99481-c5e7-4e4f-b396-e8359fab71b9/davines-naturaltech-well-being-shampoo.jpg',5),
 ('Davines Naturaltech','Purifying Shampoo','/__l5e/assets-v1/de1fa733-5d58-4d43-9f29-b8f20dce03be/davines-naturaltech-purifying-shampoo.jpg',6);

CREATE TABLE public.customer_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('gift_card_20','hairspray','birthday_beard')),
  reward_key text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','redeemed')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  year integer,
  threshold integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, reward_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_rewards TO authenticated;
GRANT ALL ON public.customer_rewards TO service_role;
ALTER TABLE public.customer_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all rewards" ON public.customer_rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "media read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "media admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "media admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "media admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));