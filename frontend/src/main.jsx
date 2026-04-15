import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/common.css";
import "./styles/home.css";
import "./styles/products.css";
import "./styles/login.css";
import "./styles/profile.css";
import "./styles/my-listings.css";
import "./styles/product-details.css";
import "./styles/admin-dashboard.css";
import "./styles/wishlist.css";
import "./styles/rentals.css";
import { HomePage } from "./pages/HomePage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailsPage } from "./pages/ProductDetailsPage";
import { LoginPage, RegisterPage } from "./pages/LoginRegisterPages";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/RecoveryPages";
import { ProfilePage } from "./pages/ProfilePage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { WishlistPage } from "./pages/WishlistPage";
import { BookingsPage, RentalsPage } from "./pages/RentalPages";

const pages = {
  home: HomePage,
  products: ProductsPage,
  "product-details": ProductDetailsPage,
  login: LoginPage,
  register: RegisterPage,
  "forgot-password": ForgotPasswordPage,
  "reset-password": ResetPasswordPage,
  "verify-email": VerifyEmailPage,
  profile: ProfilePage,
  wishlist: WishlistPage,
  "my-listings": MyListingsPage,
  bookings: BookingsPage,
  rentals: RentalsPage,
  admin: AdminDashboardPage,
};

const page = document.body.dataset.page || "home";
const PageComponent = pages[page] || HomePage;

createRoot(document.getElementById("root")).render(<PageComponent page={page} />);
