import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const htmlEntries = {
  home: path.resolve("frontend/index.html"),
  products: path.resolve("frontend/html/products.html"),
  productDetails: path.resolve("frontend/html/product-details.html"),
  login: path.resolve("frontend/html/login.html"),
  register: path.resolve("frontend/html/register.html"),
  forgotPassword: path.resolve("frontend/html/forgot-password.html"),
  resetPassword: path.resolve("frontend/html/reset-password.html"),
  profile: path.resolve("frontend/html/profile.html"),
  wishlist: path.resolve("frontend/html/wishlist.html"),
  myListings: path.resolve("frontend/html/my-listings.html"),
  bookings: path.resolve("frontend/html/bookings.html"),
  rentals: path.resolve("frontend/html/rentals.html"),
  adminDashboard: path.resolve("frontend/html/admin-dashboard.html"),
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin =
    env.VITE_API_ORIGIN?.trim() ||
    `http://localhost:${env.PORT?.trim() || "3000"}`;

  return {
    root: "frontend",
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
        },
        "/uploads": {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: htmlEntries,
      },
    },
  };
});
