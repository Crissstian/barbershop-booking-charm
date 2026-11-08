import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Deployment indipendente da Lovable. Nitro rileva Vercel durante il build.
// Manteniamo l'entry SSR personalizzata già usata dal progetto.
export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
