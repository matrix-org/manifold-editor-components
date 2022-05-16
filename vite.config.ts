import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from "vite-plugin-dts";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dts()],
  build: {
    lib: {
      entry: "./src/lib.ts",
      formats: ["es"],
      fileName: "manifold-editor-components"
    },
    rollupOptions: {
      external: [...Object.keys(pkg.peerDependencies), "react/jsx-runtime"]
    }
  }
})
