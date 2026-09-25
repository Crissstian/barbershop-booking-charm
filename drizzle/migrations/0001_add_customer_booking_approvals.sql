CREATE TABLE public.customer_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 2 AND 50),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 2 AND 50),
  email text NOT NULL CHECK (char_length(email) <= 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customer_approvals_email_unique ON public.customer_approvals (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_approvals TO authenticated;
GRANT ALL ON public.customer_approvals TO service_role;

ALTER TABLE public.customer_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all customer approvals"
ON public.customer_approvals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
