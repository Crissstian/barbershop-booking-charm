-- SOLO se parti da un nuovo Supabase SENZA dati importati da Lovable.
-- Eseguire DOPO gli SQL 0000..0006 e setup-media-and-assets.sql.
-- NON eseguire se hai già importato lo storico dal vecchio backend.
-- I 3 UUID storici rimangono identici; Alessia usa un UUID riservato per lo seed.
update public.barbers set name='Nicola', role_title='Founder', sort=1, active=true,
 slug='nicola', service_categories=ARRAY['capelli','barba']::text[]
where id='11111111-0000-0000-0000-000000000001';
update public.barbers set name='Daniele', role_title='Barber', sort=3, active=true,
 slug='daniele', service_categories=ARRAY['capelli','barba']::text[]
where id='11111111-0000-0000-0000-000000000002';
update public.barbers set name='Antonio', role_title='Responsabile & Senior Barber', sort=2, active=true,
 slug='antonio', service_categories=ARRAY['capelli','barba']::text[]
where id='11111111-0000-0000-0000-000000000003';

insert into public.barbers(id,name,role_title,sort,active,slug,service_categories,bio)
values ('11111111-0000-0000-0000-000000000004', 'Alessia','Junior Barber',4,true,'alessia',ARRAY['barba']::text[],null)
on conflict (id) do update set name=excluded.name,role_title=excluded.role_title,
 sort=excluded.sort,active=true,slug=excluded.slug,service_categories=excluded.service_categories;

insert into public.working_hours(barber_id,weekday,start_time,end_time)
select '11111111-0000-0000-0000-000000000004'::uuid, d, x.s, x.e
from generate_series(2,6) as d,
(values ('09:00'::time,'13:00'::time),('14:30'::time,'19:30'::time)) as x(s,e)
where not exists (select 1 from public.working_hours w
                  where w.barber_id='11111111-0000-0000-0000-000000000004'::uuid
                    and w.weekday=d and w.start_time=x.s and w.end_time=x.e);

-- Mantieni vecchi record inattivi per integrità storica.
update public.services set active=false
where name in ('Taglio','Barba','Taglio + Barba','Shampoo & Piega')
   or (name='Colore' and duration_min=60 and price=40);

-- Nuovo listino ufficiale (11 righe). Attivazione idempotente sul nome.
with official(name, price, duration_min, category, price_from, sort, counts_as_haircut) as (
 values
  ('Taglio capelli + shampoo',18::numeric,30,'capelli',false,1,true),
  ('Taglio capelli',12::numeric,30,'capelli',false,2,true),
  ('Taglio bambino + shampoo',14::numeric,30,'capelli',false,3,true),
  ('Taglio capelli bambino',10::numeric,30,'capelli',false,4,true),
  ('Shampoo + piega',8::numeric,80,'capelli',false,5,false),
  ('Trattamento alla keratina',20::numeric,80,'capelli',true,6,false),
  ('Colore',10::numeric,80,'capelli',true,7,false),
  ('Barba classica',7::numeric,20,'barba',false,8,false),
  ('Rasatura barba',5::numeric,20,'barba',false,9,false),
  ('Barba + trattamento',8::numeric,20,'barba',false,10,false),
  ('Barba + colore',7::numeric,20,'barba',false,11,false)
)
insert into public.services(name,price,duration_min,category,price_from,sort,counts_as_haircut,active)
select o.name,o.price,o.duration_min,o.category,o.price_from,o.sort,o.counts_as_haircut,true
from official o
where not exists (select 1 from public.services s where s.name=o.name and s.active);

-- Assicurati che Alessia sia abilitata a tutti e solo i servizi Barba attivi.
delete from public.barber_services
where barber_id='11111111-0000-0000-0000-000000000004'::uuid
  and service_id in (select id from public.services where category<>'barba');
insert into public.barber_services(barber_id,service_id)
select '11111111-0000-0000-0000-000000000004'::uuid,id
from public.services where category='barba' and active
on conflict (barber_id,service_id) do nothing;
