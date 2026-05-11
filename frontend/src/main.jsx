import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/common.css";

const pageLoaders = {
  home: () => import("./pages/HomePage").then((module) => module.HomePage),
  products: () =>
    import("./pages/ProductsPage").then((module) => module.ProductsPage),
  "product-details": () =>
    import("./pages/ProductDetailsPage").then(
      (module) => module.ProductDetailsPage,
    ),
  login: () =>
    import("./pages/LoginRegisterPages").then((module) => module.LoginPage),
  register: () =>
    import("./pages/LoginRegisterPages").then((module) => module.RegisterPage),
  "forgot-password": () =>
    import("./pages/RecoveryPages").then(
      (module) => module.ForgotPasswordPage,
    ),
  "reset-password": () =>
    import("./pages/RecoveryPages").then((module) => module.ResetPasswordPage),
  "verify-email": () =>
    import("./pages/RecoveryPages").then((module) => module.VerifyEmailPage),
  profile: () =>
    import("./pages/ProfilePage").then((module) => module.ProfilePage),
  wishlist: () =>
    import("./pages/WishlistPage").then((module) => module.WishlistPage),
  "my-listings": () =>
    import("./pages/MyListingsPage").then((module) => module.MyListingsPage),
  bookings: () =>
    import("./pages/RentalPages").then((module) => module.BookingsPage),
  rentals: () =>
    import("./pages/RentalPages").then((module) => module.RentalsPage),
  admin: () =>
    import("./pages/AdminDashboardPage").then(
      (module) => module.AdminDashboardPage,
    ),
};

const page = document.body.dataset.page || "home";

function PageLoadErrorState({ message }) {
  return (
    <main className="page-shell">
      <section className="section">
        <div className="surface-panel">
          <p className="message message--error" role="alert">
            {message}
          </p>
        </div>
      </section>
    </main>
  );
}

function AppBootstrap() {
  const [PageComponent, setPageComponent] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPageComponent() {
      try {
        const loadPage = pageLoaders[page] || pageLoaders.home;
        const nextPageComponent = await loadPage();

        if (!active) {
          return;
        }

        setLoadError("");
        setPageComponent(() => nextPageComponent);
      } catch (error) {
        console.error(`Failed to load page bundle for "${page}"`, error);

        if (!active) {
          return;
        }

        setPageComponent(null);
        setLoadError("Unable to load this page right now. Please refresh.");
      }
    }

    loadPageComponent();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!PageComponent && !loadError) {
      return undefined;
    }

    const hideBootLoader = () => {
      if (typeof window.__AIRentHideBootLoader === "function") {
        window.__AIRentHideBootLoader();
        return;
      }

      document.body.classList.remove("app-shell-loading", "app-shell-delayed");
      document.body.classList.add("app-shell-ready");
      document.getElementById("app-boot-loader")?.remove();
    };

    if (document.readyState === "complete") {
      hideBootLoader();
      return undefined;
    }

    window.addEventListener("load", hideBootLoader, { once: true });

    return () => {
      window.removeEventListener("load", hideBootLoader);
    };
  }, [PageComponent, loadError]);

  if (loadError) {
    return <PageLoadErrorState message={loadError} />;
  }

  if (!PageComponent) {
    return null;
  }

  return <PageComponent page={page} />;
}

createRoot(document.getElementById("root")).render(<AppBootstrap />);
