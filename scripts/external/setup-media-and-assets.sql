-- SOLO SU SUPABASE ESTERNO, dopo gli script 0000..0006.
-- Bucket privato per upload futuri dell'admin: le policy esistono nelle migrazioni 0005 e 0006.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Asset statici del sito: aggiornamento dei 6 prodotti già seminati da 0005.
-- Non modifica nomi, prezzi o storico; solo percorsi immagini.
update public.products
set image_url = case name
  when 'Energizing Shampoo' then '/media/products/davines-naturaltech-energizing-shampoo.jpg'
  when 'Nourishing Shampoo' then '/media/products/davines-naturaltech-nourishing-shampoo.jpg'
  when 'Replumping Shampoo' then '/media/products/davines-naturaltech-replumping-shampoo.jpg'
  when 'Rebalancing Shampoo' then '/media/products/davines-naturaltech-rebalancing-shampoo.jpg'
  when 'Well-Being Shampoo' then '/media/products/davines-naturaltech-well-being-shampoo.jpg'
  when 'Purifying Shampoo' then '/media/products/davines-naturaltech-purifying-shampoo.jpg'
  else image_url
end
where brand = 'Davines Naturaltech';
