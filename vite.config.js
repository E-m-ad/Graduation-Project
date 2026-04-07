import { defineConfig } from "vite";
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
  verifyEmail: path.resolve("frontend/html/verify-email.html"),
  profile: path.resolve("frontend/html/profile.html"),
  wishlist: path.resolve("frontend/html/wishlist.html"),
  myListings: path.resolve("frontend/html/my-listings.html"),
  adminDashboard: path.resolve("frontend/html/admin-dashboard.html"),
};

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3000",
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
});
