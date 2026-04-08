import React, { useEffect, useState } from "react";
import { fetchApi } from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import { MessageText } from "../components/Common";
import { SiteLayout } from "../components/Layout";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function AuthIntro({ eyebrow, title, description }) {
  return (
    <article className="auth-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </article>
  );
}

function RecoveryShell({ page, user, logout, intro, children }) {
  return (
    <SiteLayout page={page} user={user} onLogout={logout}>
      <div className="auth-page">
        <section className="auth-layout auth-layout--compact">
          {intro}
          {children}
        </section>
      </div>
    </SiteLayout>
  );
}

export function ForgotPasswordPage({ page }) {
  const { user, logout } = useSession();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState("");
  const [message, showMessage] = useMessageState("");

  useEffect(() => {
    document.title = "Forgot Password | AI Rent";
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setEmailError("");
    setToken("");
    showMessage("");

    if (!validateEmail(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);

    const result = await fetchApi("/api/v1/auth/forgot-password", {
      method: "POST",
      body: { email: email.trim() },
    });

    setSubmitting(false);

    if (!result.ok || !result.data?.success) {
      showMessage(
        result.data?.message || "Unable to process your request.",
        "error",
      );
      return;
    }

    showMessage(result.data.message || "Reset instructions sent.", "success");
    if (result.data.resetToken) {
      setToken(result.data.resetToken);
    }
  }

  return (
    <RecoveryShell
      page={page}
      user={user}
      logout={logout}
      intro={
        <AuthIntro
          eyebrow="Password recovery"
          title="Request a reset link."
          description="Enter your email and the back-end will return a reset token in development mode so you can continue testing the flow quickly."
        />
      }
    >
      <section className="auth-card">
        <div className="auth-card__header">
          <h2>Forgot Password</h2>
          <p>We will guide you to the reset page.</p>
        </div>

        <form className="stack-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="forgotEmail">Email</label>
            <input
              id="forgotEmail"
              type="email"
              className="input"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="field-error">{emailError}</p>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
            {submitting ? "Sending..." : "Send Reset Request"}
          </button>
          <MessageText message={message} />
        </form>

        {token ? (
          <section className="token-box">
            <h3>Development token</h3>
            <p>Use this token on the reset page while testing locally.</p>
            <code>{token}</code>
            <a
              className="btn btn--secondary btn--small"
              href={`/html/reset-password.html?token=${encodeURIComponent(token)}`}
            >
              Open Reset Page
            </a>
          </section>
        ) : null}
      </section>
    </RecoveryShell>
  );
}

export function ResetPasswordPage({ page }) {
  const { user, logout } = useSession();
  const [form, setForm] = useState({
    token: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, showMessage] = useMessageState("");

  useEffect(() => {
    document.title = "Reset Password | AI Rent";
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setForm((previous) => ({ ...previous, token }));
    }
  }, []);

  function validateForm() {
    const nextErrors = {};

    if (!form.token.trim()) {
      nextErrors.token = "Reset token is required.";
    }
    if (form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    } else if (!/[A-Z]/.test(form.password)) {
      nextErrors.password = "Password must include one uppercase letter.";
    } else if (!/[0-9]/.test(form.password)) {
      nextErrors.password = "Password must include one number.";
    }
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    showMessage("");

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const result = await fetchApi("/api/v1/auth/reset-password", {
      method: "POST",
      body: {
        token: form.token.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      },
    });

    setSubmitting(false);

    if (!result.ok || !result.data?.success) {
      showMessage(
        result.data?.error?.message ||
          result.data?.message ||
          "Unable to reset your password.",
        "error",
      );
      return;
    }

    showMessage(
      result.data.message || "Password reset successfully. Redirecting to login...",
      "success",
    );

    window.setTimeout(() => {
      window.location.href = "/html/login.html";
    }, 900);
  }

  return (
    <RecoveryShell
      page={page}
      user={user}
      logout={logout}
      intro={
        <AuthIntro
          eyebrow="Set a new password"
          title="Finish the recovery flow."
          description="Paste the reset token and choose a new password that includes at least one uppercase letter and one number."
        />
      }
    >
      <section className="auth-card">
        <div className="auth-card__header">
          <h2>Reset Password</h2>
          <p>Complete the final step for your account.</p>
        </div>

        <form className="stack-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="resetToken">Reset token</label>
            <input
              id="resetToken"
              type="text"
              className="input"
              placeholder="Paste your reset token"
              value={form.token}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, token: event.target.value }))
              }
            />
            <p className="field-error">{errors.token || ""}</p>
          </div>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              className="input"
              placeholder="Choose a new password"
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />
            <p className="field-error">{errors.password || ""}</p>
          </div>

          <div className="field">
            <label htmlFor="confirmNewPassword">Confirm new password</label>
            <input
              id="confirmNewPassword"
              type="password"
              className="input"
              placeholder="Repeat your new password"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  confirmPassword: event.target.value,
                }))
              }
            />
            <p className="field-error">{errors.confirmPassword || ""}</p>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
            {submitting ? "Resetting..." : "Reset Password"}
          </button>
          <MessageText message={message} />
        </form>
      </section>
    </RecoveryShell>
  );
}
