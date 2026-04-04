const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetTokenInput = document.getElementById("resetToken");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const resetFormMessage = document.getElementById("formMessage");

const tokenError = document.getElementById("tokenError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");

function clearResetErrors() {
  tokenError.textContent = "";
  passwordError.textContent = "";
  confirmPasswordError.textContent = "";
  AIRent.showMessage(resetFormMessage, "");
}

function validateResetForm() {
  let isValid = true;

  if (!resetTokenInput.value.trim()) {
    tokenError.textContent = "Reset token is required.";
    isValid = false;
  }

  if (newPasswordInput.value.length < 6) {
    passwordError.textContent = "Password must be at least 6 characters.";
    isValid = false;
  } else if (!/[A-Z]/.test(newPasswordInput.value)) {
    passwordError.textContent = "Password must include one uppercase letter.";
    isValid = false;
  } else if (!/[0-9]/.test(newPasswordInput.value)) {
    passwordError.textContent = "Password must include one number.";
    isValid = false;
  }

  if (newPasswordInput.value !== confirmNewPasswordInput.value) {
    confirmPasswordError.textContent = "Passwords do not match.";
    isValid = false;
  }

  return isValid;
}

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResetErrors();

  if (!validateResetForm()) {
    return;
  }

  resetPasswordBtn.disabled = true;
  resetPasswordBtn.textContent = "Resetting...";

  const result = await AIRent.fetchApi("/api/v1/auth/reset-password", {
    method: "POST",
    body: {
      token: resetTokenInput.value.trim(),
      password: newPasswordInput.value,
      confirmPassword: confirmNewPasswordInput.value,
    },
  });

  resetPasswordBtn.disabled = false;
  resetPasswordBtn.textContent = "Reset Password";

  if (!result.ok || !result.data?.success) {
    AIRent.showMessage(
      resetFormMessage,
      result.data?.error?.message ||
        result.data?.message ||
        "Unable to reset your password.",
      "error",
    );
    return;
  }

  AIRent.showMessage(
    resetFormMessage,
    result.data.message || "Password reset successfully. Redirecting to login...",
    "success",
  );

  window.setTimeout(() => {
    window.location.href = "/html/login.html";
  }, 900);
});

(function initializeResetPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    resetTokenInput.value = token;
  }
})();
