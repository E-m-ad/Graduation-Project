const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotEmailInput = document.getElementById("forgotEmail");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const forgotEmailError = document.getElementById("emailError");
const forgotFormMessage = document.getElementById("formMessage");
const tokenBox = document.getElementById("tokenBox");
const resetTokenValue = document.getElementById("resetTokenValue");
const resetLink = document.getElementById("resetLink");

function validateForgotEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  forgotEmailError.textContent = "";
  tokenBox.hidden = true;
  AIRent.showMessage(forgotFormMessage, "");

  const email = forgotEmailInput.value.trim();
  if (!validateForgotEmail(email)) {
    forgotEmailError.textContent = "Enter a valid email address.";
    return;
  }

  forgotPasswordBtn.disabled = true;
  forgotPasswordBtn.textContent = "Sending...";

  const result = await AIRent.fetchApi("/api/v1/auth/forgot-password", {
    method: "POST",
    body: { email },
  });

  forgotPasswordBtn.disabled = false;
  forgotPasswordBtn.textContent = "Send Reset Request";

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      forgotFormMessage,
      result.data?.message || "Unable to process your request.",
      "error",
    );
    return;
  }

  AIRent.showMessage(
    forgotFormMessage,
    result.data.message || "Reset instructions sent.",
    "success",
  );

  if (result.data.resetToken) {
    tokenBox.hidden = false;
    resetTokenValue.textContent = result.data.resetToken;
    resetLink.href = `/html/reset-password.html?token=${encodeURIComponent(
      result.data.resetToken,
    )}`;
  }
});
