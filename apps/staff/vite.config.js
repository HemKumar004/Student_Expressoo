import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Student Expressoo — Staff Portal. Independently runnable, buildable and deployable.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
  build: { sourcemap: false, chunkSizeWarningLimit: 800 },
});
