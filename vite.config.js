import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const appShellDir = path.resolve("frontend/app-shell");

function readAppShellFile(filename) {
  return fs.readFileSync(path.join(appShellDir, filename), "utf8").trim();
}

function readLoadingShellParts() {
  return {
    style: readAppShellFile("boot-loader.css"),
    markup: [
      readAppShellFile("boot-loader.html"),
      readAppShellFile("boot-loader.js"),
    ].join("\n"),
  };
}

function loadingShellPlugin() {
  return {
    name: "loading-shell-plugin",
    configureServer(server) {
      server.watcher.add(appShellDir);
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(appShellDir)) {
        return;
      }

      server.ws.send({
        type: "full-reload",
      });

      return [];
    },
    transformIndexHtml(html) {
      const loadingShell = readLoadingShellParts();

      return html
        .replace("</head>", `${loadingShell.style}\n  </head>`)
        .replace("<body ", '<body class="app-shell-loading" ')
        .replace(
          '<div id="root"></div>',
          `${loadingShell.markup}\n    <div id="root"></div>`,
        );
    },
  };
}

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
  bookings: path.resolve("frontend/html/bookings.html"),
  rentals: path.resolve("frontend/html/rentals.html"),
  adminDashboard: path.resolve("frontend/html/admin-dashboard.html"),
};

function normalizeBackendOrigin(configuredOrigin, fallbackPort) {
  const fallbackOrigin = `http://127.0.0.1:${fallbackPort || "8080"}`;
  const rawOrigin = configuredOrigin?.trim();

  if (!rawOrigin) {
    return fallbackOrigin;
  }

  try {
    const normalizedUrl = new URL(rawOrigin);

    if (normalizedUrl.hostname === "localhost") {
      normalizedUrl.hostname = "127.0.0.1";
    }

    return normalizedUrl.toString().replace(/\/$/, "");
  } catch {
    return fallbackOrigin;
  }
}

function createDevProxy(target, kind) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    configure(proxy) {
      proxy.on("error", (error, req, res) => {
        const requestPath = req.url || "/";
        const reason =
          error?.code ||
          error?.message ||
          "Unable to reach development backend";

        console.warn(
          `[vite-proxy] ${requestPath} -> ${target} failed (${reason}). Start the backend with "npm run dev".`,
        );

        if (!res || res.headersSent) {
          return;
        }

        if (kind === "api") {
          res.writeHead(502, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              success: false,
              message:
                'The frontend dev server is running, but the backend API is not reachable. Start the backend with "npm run dev".',
            }),
          );
          return;
        }

        res.writeHead(502, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        res.end(
          'The frontend dev server is running, but the backend file server is not reachable. Start the backend with "npm run dev".',
        );
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin = normalizeBackendOrigin(
    env.VITE_API_ORIGIN,
    env.PORT?.trim(),
  );

  return {
    root: "frontend",
    plugins: [react(), loadingShellPlugin()],
    server: {
      proxy: {
        "/api": createDevProxy(backendOrigin, "api"),
        "/uploads": createDevProxy(backendOrigin, "uploads"),
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
