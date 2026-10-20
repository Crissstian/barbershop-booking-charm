CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Professionisti: slug e foto stabili
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS photo_url text;
CREATE UNIQUE INDEX IF NOT EXISTS barbers_slug_key ON public.barbers (slug) WHERE slug IS NOT NULL;

-- Servizi abilitati per professionista
CREATE TABLE public.barber_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barber_id, service_id)
);
GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read barber services" ON public.barber_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin all barber services" ON public.barber_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anagrafica clienti
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL DEFAULT '',
  phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '\D', '', 'g')) STORED,
  birth_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_email_key ON public.customers (lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX customers_phone_key ON public.customers (phone_normalized) WHERE phone_normalized <> '';
CREATE INDEX customers_name_idx ON public.customers (lower(last_name), lower(first_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.customer_approvals ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.appointments ADD COLUMN amount_paid numeric(8,2);
CREATE INDEX appointments_customer_idx ON public.appointments (customer_id);

-- Backfill clienti dalle autorizzazioni approvate
INSERT INTO public.customers (first_name, last_name, email, phone)
SELECT ca.first_name, ca.last_name, lower(ca.email),
  coalesce(nullif(ca.phone, ''), (SELECT a.customer_phone FROM public.appointments a WHERE lower(a.customer_email) = lower(ca.email) AND a.status = 'confirmed' ORDER BY a.created_at DESC LIMIT 1), '')
FROM public.customer_approvals ca WHERE ca.status = 'approved';
UPDATE public.customer_approvals ca SET customer_id = c.id FROM public.customers c WHERE lower(c.email) = lower(ca.email);
UPDATE public.appointments a SET customer_id = c.id FROM public.customers c WHERE lower(c.email) = lower(a.customer_email);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_status_check CHECK (payment_status IN ('pending','paid','complimentary'));

-- Anti doppia prenotazione atomico
ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed');