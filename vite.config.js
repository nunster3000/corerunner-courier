import { defineConfig } from "vite";
export default defineConfig({
  server: {
    watch: {
      ignored: [
        "**/data/**",
        "**/test-results/**",
        "**/playwright-report/**",
        "**/server/**",
      ],
    },
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT || 3001}` },
  },
  preview: {
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT || 3001}` },
  },
});
