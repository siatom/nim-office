import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development.
  clearScreen: false,
  server: {
    // 1420 is Tauri's default and is frequently taken by other Tauri projects
    // running side by side; 1430 keeps parallel checkouts from colliding.
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "docx-editor",
              test: /node_modules[\\/]@docx-editor\.dev[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
              maxSize: 1_500_000,
            },
          ],
        },
      },
    },
  },
}));
