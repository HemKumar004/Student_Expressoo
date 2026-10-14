import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Student Expressoo — Admin Console. Independently runnable, buildable and deployable.
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
  build: { sourcemap: false, chunkSizeWarningLimit: 800 },
});
