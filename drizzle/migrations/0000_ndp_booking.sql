create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.first_user_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.first_user_admin();

create table public.barbers (id uuid primary key default gen_random_uuid(), name text not null, role_title text not null default 'Hair stylist', bio text, sort int not null default 0, active boolean not null default true, created_at timestamptz default now());
create table public.services (id uuid primary key default gen_random_uuid(), name text not null, description text, duration_min int not null, price numeric(8,2) not null, sort int not null default 0, active boolean not null default true);
create table public.working_hours (id uuid primary key default gen_random_uuid(), barber_id uuid references public.barbers(id) on delete cascade not null, weekday int not null check (weekday between 0 and 6), start_time time not null, end_time time not null);
create table public.blocked_slots (id uuid primary key default gen_random_uuid(), barber_id uuid references public.barbers(id) on delete cascade not null, starts_at timestamptz not null, ends_at timestamptz not null, reason text);
create table public.appointments (id uuid primary key default gen_random_uuid(), barber_id uuid references public.barbers(id) on delete cascade not null, service_id uuid references public.services(id) not null, starts_at timestamptz not null, ends_at timestamptz not null, customer_name text not null, customer_phone text not null, customer_email text, notes text, status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed')), code text not null, token uuid not null default gen_random_uuid() unique, created_at timestamptz default now());
create index on public.appointments(barber_id, starts_at);

grant select on public.barbers, public.services, public.working_hours to anon, authenticated;
grant insert, update, delete on public.barbers, public.services, public.working_hours to authenticated;
grant select, insert, update, delete on public.blocked_slots, public.appointments to authenticated;
grant all on public.barbers, public.services, public.working_hours, public.blocked_slots, public.appointments to service_role;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.appointments enable row level security;
create policy "public read" on public.barbers for select to anon, authenticated using (true);
create policy "public read" on public.services for select to anon, authenticated using (true);
create policy "public read" on public.working_hours for select to anon, authenticated using (true);
create policy "admin all" on public.barbers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.working_hours for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.blocked_slots for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin all" on public.appointments for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.barbers(id,name,role_title,bio,sort) values
('11111111-0000-0000-0000-000000000001','Nicola','Fondatore & Master Stylist','Il nome sull''insegna. Tagli sartoriali e consulenza d''immagine.',1),
('11111111-0000-0000-0000-000000000002','Daniele','Senior Barber','Sfumature precise e cura della barba all''italiana.',2),
('11111111-0000-0000-0000-000000000003','Antonio','Stylist','Tagli contemporanei, texture e styling.',3);
insert into public.services(name,description,duration_min,price,sort) values
('Taglio','Consulenza, shampoo, taglio e styling',45,30,1),
('Barba','Rifinitura, panno caldo e oli',30,20,2),
('Taglio + Barba','Il rituale completo NDP',75,45,3),
('Shampoo & Piega','Lavaggio e styling',30,18,4),
('Colore','Colorazione e trattamento',60,40,5);
insert into public.working_hours(barber_id,weekday,start_time,end_time)
select b.id, d, t.s, t.e from public.barbers b, generate_series(2,6) d, (values ('09:00'::time,'13:00'::time),('14:30'::time,'19:30'::time)) t(s,e);