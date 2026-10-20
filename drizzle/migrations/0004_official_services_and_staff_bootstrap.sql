ALTER TABLE public.services ADD COLUMN category text NOT NULL DEFAULT 'capelli', ADD COLUMN price_from boolean NOT NULL DEFAULT false;
ALTER TABLE public.services ADD CONSTRAINT services_category_valid CHECK (category IN ('capelli','barba'));
ALTER TABLE public.barbers ADD COLUMN service_categories text[] NOT NULL DEFAULT ARRAY['capelli','barba']::text[];
CREATE OR REPLACE FUNCTION public.sync_service_eligibility() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 DELETE FROM public.barber_services WHERE service_id=NEW.id;
 INSERT INTO public.barber_services(barber_id,service_id) SELECT id,NEW.id FROM public.barbers WHERE NEW.category=ANY(service_categories);
 RETURN NEW;
END $$;
CREATE TRIGGER services_sync_eligibility AFTER INSERT OR UPDATE OF category ON public.services FOR EACH ROW EXECUTE FUNCTION public.sync_service_eligibility();
CREATE OR REPLACE FUNCTION public.guard_staff_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7142026);
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') AND COALESCE(NEW.raw_app_meta_data->>'staff_invited','false') <> 'true' THEN
 RAISE EXCEPTION 'La registrazione staff è chiusa. Richiedi un invito a Nicola.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_staff_signup BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.guard_staff_signup();
CREATE OR REPLACE FUNCTION public.first_user_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') OR COALESCE(NEW.raw_app_meta_data->>'staff_invited','false')='true' THEN
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_staff_signup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_service_eligibility() FROM PUBLIC;