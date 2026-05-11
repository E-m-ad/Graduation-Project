import React, { useEffect, useState } from "react";
import "../styles/login.css";
import {
  fetchApi,
  getDefaultAuthenticatedPath,
  getResultMessage,
  goToNextPage,
  isSuccessfulResult,
  saveSession,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import { MessageText } from "../components/Common";
import { SiteLayout } from "../components/Layout";

// Reuse this on any page by changing the target, active selectors, or disabled sections.
const CURSOR_CONFIG = {
  login: {
    enabled: true,
    color: "#000000",
    targetSelector: ".auth-page",
    activeSelectors: [],
    deactiveSelectors: [".auth-card"],
  },
  register: {
    enabled: true,
    color: "#000000",
    targetSelector: ".auth-page",
    activeSelectors: [],
    deactiveSelectors: [".auth-card"],
  },
};

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function AuthIntro({ eyebrow, title, description }) {
  return (
    <article className="auth-intro">
      <div className="inner-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </article>
  );
}

function AuthPageShell({ page, user, logout, intro, children, cursorConfig }) {
  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      cursorConfig={cursorConfig}
    >
      <div className="auth-page">
        <section className="auth-layout">
          {intro}
          {children}
        </section>
      </div>
    </SiteLayout>
  );
}

export function LoginPage({ page }) {
  const { user, loading, refreshUser, logout } = useSession();
  const [form, setForm] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationPreview, setVerificationPreview] = useState(null);
  const [message, showMessage] = useMessageState("");

  useEffect(() => {
    document.title = "Login | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  function validateForm() {
    const nextErrors = {};

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!validateEmail(form.email.trim())) {
      nextErrors.email = "Please enter a valid email.";
    }

    if (!form.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (form.password.trim().length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    showMessage("");
    setVerificationPreview(null);

    if (!validateForm()) return;

    setSubmitting(true);

    const result = await fetchApi("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: form.email.trim(),
        password: form.password.trim(),
      },
    });

    if (!isSuccessfulResult(result)) {
      const normalizedEmail = form.email.trim();
      if (
        result.data?.requiresEmailVerification ||
        result.data?.code === "EMAIL_NOT_VERIFIED"
      ) {
        setVerificationEmail(normalizedEmail);
        if (result.data.verificationLink || result.data.verificationToken) {
          setVerificationPreview({
            verificationLink: result.data.verificationLink || "",
            verificationToken: result.data.verificationToken || "",
          });
        }
      }

      showMessage(
        getResultMessage(
          result,
          "Login failed. Please check your credentials.",
        ),
        "error",
      );
      setSubmitting(false);
      return;
    }

    saveSession({
      accessToken: result.data.accessToken,
      remember: form.rememberMe,
    });

    const nextUser = await refreshUser(true);
    showMessage("Login successful. Redirecting...", "success");
    setSubmitting(false);

    window.setTimeout(() => {
      if (nextUser?.role === "admin") {
        window.location.href = getDefaultAuthenticatedPath(nextUser);
        return;
      }

      goToNextPage(getDefaultAuthenticatedPath(nextUser));
    }, 500);
  }

  async function handleResendVerification() {
    const normalizedEmail = form.email.trim();
    if (!validateEmail(normalizedEmail)) {
      setErrors((previous) => ({
        ...previous,
        email: "Enter the same email you used when registering.",
      }));
      return;
    }

    setResendingVerification(true);
    setVerificationPreview(null);

    const result = await fetchApi("/api/v1/auth/request-email-verification", {
      method: "POST",
      body: {
        email: normalizedEmail,
      },
    });

    setResendingVerification(false);
    setVerificationEmail(normalizedEmail);

    showMessage(
      result.data?.message || "Verification email request updated.",
      result.ok ? "success" : "error",
    );

    if (!isSuccessfulResult(result)) {
      return;
    }

    if (result.data.verificationLink || result.data.verificationToken) {
      setVerificationPreview({
        verificationLink: result.data.verificationLink || "",
        verificationToken: result.data.verificationToken || "",
      });
    }
  }

  return (
    <AuthPageShell
      page={page}
      user={user}
      logout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
      intro={
        <AuthIntro
          eyebrow="Welcome back"
          title="Sign in to continue managing rentals."
          description="Use your account to explore products, submit rental requests, and manage your listings from the same simple dashboard."
          points={[
            "Browse public listings and product details.",
            "Save items to your wishlist.",
            "Track your bookings, requests, and profile.",
          ]}
        />
      }
    >
      <section className="auth-card">
        <div className="auth-card__header">
          <h2>Login</h2>
        </div>

        <form className="stack-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="name@example.com"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />
            <p
              className={`field-error${errors.email ? " visible" : " hidden"}`}
            >
              {errors.email || ""}
            </p>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />
            <p
              className={`field-error${errors.password ? " visible" : " hidden"}`}
            >
              {errors.password || ""}
            </p>
          </div>

          <div className="auth-card__row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    rememberMe: event.target.checked,
                  }))
                }
              />
              <span>Remember me</span>
            </label>
            <a href="/html/forgot-password.html">Forgot password?</a>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
          <MessageText message={message} />
        </form>

        {verificationEmail ? (
          <section className="token-box">
            <h3>Need a fresh verification email?</h3>
            <p>
              If this account is waiting for email verification, we can send a
              new verification link to <strong>{verificationEmail}</strong>.
            </p>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={handleResendVerification}
              disabled={resendingVerification}
            >
              {resendingVerification
                ? "Sending verification..."
                : "Resend verification email"}
            </button>
            {verificationPreview?.verificationToken ? (
              <code>{verificationPreview.verificationToken}</code>
            ) : null}
            {verificationPreview?.verificationLink ? (
              <a
                className="btn btn--ghost btn--small"
                href={verificationPreview.verificationLink}
              >
                Open Verify Page
              </a>
            ) : null}
          </section>
        ) : null}

        <p className="auth-footer">
          New to AI Rent? <a href="/html/register.html">Create an account</a>
        </p>
      </section>
    </AuthPageShell>
  );
}

export function RegisterPage({ page }) {
  const { user, loading, logout } = useSession();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [verificationPreview, setVerificationPreview] = useState(null);
  const [message, showMessage] = useMessageState("");

  useEffect(() => {
    document.title = "Register | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  function validateForm() {
    const nextErrors = {};

    if (form.name.trim().length < 3) {
      nextErrors.name = "Name must be at least 3 characters long.";
    }
    if (!validateEmail(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (form.password.trim().length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    } else if (!/[A-Z]/.test(form.password)) {
      nextErrors.password = "Password must contain one uppercase letter.";
    } else if (!/[0-9]/.test(form.password)) {
      nextErrors.password = "Password must contain one number.";
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    showMessage("");
    setVerificationPreview(null);
    if (!validateForm()) return;

    setSubmitting(true);

    const result = await fetchApi("/api/v1/auth/register", {
      method: "POST",
      body: {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      },
    });

    setSubmitting(false);

    if (!isSuccessfulResult(result)) {
      showMessage(
        getResultMessage(result, "Registration failed. Please try again."),
        "error",
      );
      return;
    }

    showMessage(
      result.data.message ||
        "Account created successfully. Redirecting to login...",
      "success",
    );

    if (result.data.verificationLink || result.data.verificationToken) {
      setVerificationPreview({
        verificationLink: result.data.verificationLink || "",
        verificationToken: result.data.verificationToken || "",
      });
      return;
    }

    window.setTimeout(() => {
      window.location.href = "/html/login.html";
    }, 800);
  }

  return (
    <AuthPageShell
      page={page}
      user={user}
      logout={logout}
      cursorConfig={CURSOR_CONFIG[page]}
      intro={
        <AuthIntro
          eyebrow="Create your account"
          title="Join the marketplace and start renting smarter."
          description="Keep the first version simple: register once, then browse listings, request rentals, or add your own products for review."
          points={[
            "List electronics, tools, vehicles, and more.",
            "Manage bookings and owner requests.",
            "Keep the front-end aligned with the current project structure.",
          ]}
        />
      }
    >
      <section className="auth-card">
        <div className="auth-card__header">
          <h2>Register</h2>
        </div>
        <form className="stack-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder="Your full name"
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />
            <p className={`field-error${errors.name ? " visible" : " hidden"}`}>
              {errors.name || ""}
            </p>
          </div>

          <div className="field">
            <label htmlFor="registerEmail">Email</label>
            <input
              id="registerEmail"
              type="email"
              className="input"
              placeholder="name@example.com"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />
            <p
              className={`field-error${errors.email ? " visible" : " hidden"}`}
            >
              {errors.email || ""}
            </p>
          </div>

          <div className="field">
            <label htmlFor="registerPassword">Password</label>
            <input
              id="registerPassword"
              type="password"
              className="input"
              placeholder="At least 6 characters, 1 number, 1 uppercase"
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />
            <p
              className={`field-error${errors.password ? " visible" : " hidden"}`}
            >
              {errors.password || ""}
            </p>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  confirmPassword: event.target.value,
                }))
              }
            />
            <p
              className={`field-error${errors.confirmPassword ? " visible" : " hidden"}`}
            >
              {errors.confirmPassword || ""}
            </p>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
          <MessageText message={message} />
        </form>

        {verificationPreview ? (
          <section className="token-box">
            <h3>Verification link</h3>
            <p>
              Check your inbox first. In development mode, the verification link
              is also shown here so you can finish testing locally.
            </p>
            {verificationPreview.verificationToken ? (
              <code>{verificationPreview.verificationToken}</code>
            ) : null}
            {verificationPreview.verificationLink ? (
              <a
                className="btn btn--secondary btn--small"
                href={verificationPreview.verificationLink}
              >
                Open Verify Page
              </a>
            ) : null}
            <a className="btn btn--ghost btn--small" href="/html/login.html">
              Continue to Login
            </a>
          </section>
        ) : null}

        <p className="auth-footer">
          Already registered? <a href="/html/login.html">Login here</a>
        </p>
      </section>
    </AuthPageShell>
  );
}
