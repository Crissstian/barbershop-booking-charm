ALTER TABLE public.customer_approvals ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.customer_approvals ADD COLUMN IF NOT EXISTS invited_with text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS staff_notes text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  day date NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all waitlist" ON public.waitlist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));