import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

const manifestForPlugIn = {
  // ✅ Dùng đúng chiến lược cập nhật SW
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.js",

  // ✅ Auto inject code register SW
  injectRegister: "auto",
  injectManifest: {
    maximumFileSizeToCacheInBytes: 0, // ✅ TẮT HOÀN TOÀN cache tự động
  },

  // prompt: không auto-reload — app hiện nút Cập nhật / Hủy (registerSW.js)
  registerType: "prompt",

  includeAssets: [
    "favicon.ico",
    "apple-touch-icon.png",
    "maskable-icon-512x512.png",
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
  workbox: {
    cleanupOutdatedCaches: true,
    // User-controlled update (prompt) — không skipWaiting/claim tự động
    skipWaiting: false,
    clientsClaim: false,

    navigateFallbackDenylist: [/^\/assets\//],
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
    // ES2020: polyfill nhỏ hơn, parse nhanh hơn trên mobile hiện đại
    target: "es2020",
    cssCodeSplit: true,
    cssMinify: true,
    minify: "esbuild",
    // Ảnh nhỏ inline; JS lớn tách chunk
    assetsInlineLimit: 2048,
    modulePreload: {
      // Chỉ preload polyfill/module thật sự cần — bớt preload icons nặng
      polyfill: true,
      resolveDependencies: (filename, deps) => {
        // Không modulepreload icons/media lúc entry (sidebar lazy)
        return deps.filter(
          (d) =>
            !/icons-|media-|swiper|react-icons|lucide/i.test(d) &&
            !/Camera|Crop|Editor|Spotify|Snow/i.test(d),
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            "axios",
            "zustand",
            "dexie",
            "uuid",
            "jwt-decode",
            "clsx",
            "prop-types",
            "sonner",
            "ldrs",
          ],
          react: ["react", "react-dom", "react-router-dom"],
          i18n: [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
            "i18next-resources-to-backend",
          ],
          // icons/media tách riêng — chỉ tải khi sidebar / editor mở
          icons: ["lucide-react", "react-icons"],
          media: ["swiper", "react-easy-crop"],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
