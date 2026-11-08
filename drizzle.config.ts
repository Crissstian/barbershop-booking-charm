import { defineConfig } from "drizzle-kit";

// Configurazione per progetti esterni: NON puntare involontariamente al DB Lovable.
// Attenzione: drizzle/schema.ts è uno stub storico; usare gli SQL esistenti,
// NON `drizzle-kit push` o `generate` finché lo schema non viene ricostruito.
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
