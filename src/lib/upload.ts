import { supabase } from "@/integrations/supabase/client";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

/** Carica una foto nello spazio file del salone e restituisce un indirizzo stabile (10 anni). */
export async function uploadImage(file: File, folder: "staff" | "products") {
  if (!TYPES.includes(file.type)) throw new Error("Usa una foto JPG, PNG o WebP");
  if (file.size > MAX) throw new Error("La foto supera 5 MB");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Caricamento non riuscito");
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw new Error("Caricamento non riuscito");
  return data.signedUrl;
}
