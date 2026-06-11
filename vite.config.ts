// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Self-host friendly config:
// - In the Lovable sandbox, the preset is forced to cloudflare-module (overrides ignored there).
// - Outside the sandbox (your VPS / CI), we force-enable Nitro with the `node-server` preset
//   so `npm run build` produces a real Node.js HTTP server at `.output/server/index.mjs`
//   that listens on process.env.PORT (default 3000). Set PORT=3001 to match the requested port.
// - Override via the NITRO_PRESET env var if you deploy to Vercel/Netlify/etc.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: process.env.NITRO_PRESET || "node-server",
  },
});
