import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

const manifestForPlugIn = {
  // injectManifest: custom src/sw.js (network-first nav, network-only APIs)
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.js",
  // App registers via virtual:pwa-register — avoid double inject in HTML
  injectRegister: false,
  injectManifest: {
    // App shell + hashed chunks from CURRENT build (no hard-coded chunk names)
    globPatterns: [
      "index.html",
      "offline.html",
      "manifest.webmanifest",
      "assets/*.{js,css,woff2,woff}",
      "favicon*.{ico,png,svg}",
      "android-chrome-*.png",
      "apple-touch-icon.png",
      "maskable-icon-*.png",
      "fonts/**/*.{woff,woff2}",
    ],
    globIgnores: [
      "**/pwa-icons/**",
      "**/images/**",
      "**/stats.html",
      "**/prvlocket.png",
      // AI local (Upscaler/TF.js + model weights) — runtime-cache only
      "**/assets/ai-enhance-local*",
      "**/assets/*tensorflow*",
      "**/assets/*tfjs*",
      "**/assets/*upscaler*",
      "**/assets/*esrgan*",
      "**/models/esrgan-slim/**",
      "**/*.bin",
    ],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    // Extra safety: drop AI chunks from WB manifest even if names drift
    manifestTransforms: [
      async (entries) => {
        const manifest = entries.filter((e) => {
          const u = String(e.url || "");
          if (/ai-enhance-local|tensorflow|tfjs|upscaler|esrgan/i.test(u)) {
            return false;
          }
          if (/models\/esrgan-slim/i.test(u)) return false;
          if (/\.bin$/i.test(u)) return false;
          return true;
        });
        return { manifest, warnings: [] };
      },
    ],
  },

  // prompt: user confirms update — no auto skipWaiting mid-edit
  registerType: "prompt",
  // Root scope so both `/` and `/locket` are controlled
  scope: "/",
  base: "/",

  includeAssets: [
    "favicon.ico",
    "apple-touch-icon.png",
    "maskable-icon-512x512.png",
    "offline.html",
  ],

  manifest: {
    name: "Huy Locket",
    short_name: "Huy Locket",
    description: "Huy Locket - Đăng ảnh & Video lên Locket",
    display: "standalone",
    scope: "/",
    // Mở PWA/web → thẳng camera Locket
    start_url: "/locket",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
  // workbox options apply mainly to generateSW; kept for safety
  workbox: {
    cleanupOutdatedCaches: true,
    skipWaiting: false,
    clientsClaim: false,
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/assets\//, /^\/dio-/, /^\/api\//, /^\/sw\.js$/],
  },
};

const brand = process.env.VITE_BRAND;
const publicDir = brand ? `public-${brand}` : "public";

export default defineConfig({
  publicDir,
  base: "/",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  server: {
    host: true,
  },
  plugins: [tailwindcss(), react(), VitePWA(manifestForPlugIn), visualizer()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // alias @ trỏ vào thư mục src
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Isolate on-device AI so it is never in the boot/vendor graph
          if (
            id.includes("node_modules/@tensorflow") ||
            id.includes("node_modules/upscaler") ||
            id.includes("node_modules/@upscalerjs")
          ) {
            return "ai-enhance-local";
          }
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react";
          }
          if (
            id.includes("node_modules/i18next") ||
            id.includes("node_modules/react-i18next")
          ) {
            return "i18n";
          }
          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/react-icons")
          ) {
            return "icons";
          }
          if (
            id.includes("node_modules/swiper") ||
            id.includes("node_modules/react-easy-crop")
          ) {
            return "media";
          }
          if (
            id.includes("node_modules/axios") ||
            id.includes("node_modules/zustand") ||
            id.includes("node_modules/dexie") ||
            id.includes("node_modules/uuid") ||
            id.includes("node_modules/jwt-decode") ||
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/prop-types") ||
            id.includes("node_modules/sonner") ||
            id.includes("node_modules/ldrs")
          ) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1500, // tăng giới hạn warning, đỡ spam console
  },
  // Ensure model package exports resolve under Vite
  optimizeDeps: {
    exclude: ["upscaler", "@upscalerjs/esrgan-slim"],
  },
});
