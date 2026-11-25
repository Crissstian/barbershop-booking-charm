// Esegui dopo aver caricato .env.local o impostato le variabili nel terminale.
// Stampa solo i NOSTRI nomi delle variabili, mai i valori.
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
let missing = 0;
for (const key of required) {
  const ok = Boolean(process.env[key]?.trim());
  console.log(`${ok ? 'OK' : 'MANCANTE'} ${key}`);
  if (!ok) missing++;
}
if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SECRET_KEY) {
  console.error('ERRORE: una chiave segreta in una variabile VITE_ sarebbe esposta nel browser.');
  missing++;
}
if (process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL !== process.env.VITE_SUPABASE_URL) {
  console.error('ERRORE: gli URL Supabase client e server non coincidono.');
  missing++;
}
if (missing) process.exitCode = 1;
