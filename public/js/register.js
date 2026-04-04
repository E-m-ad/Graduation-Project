const registerForm = document.getElementById("registerForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("registerEmail");
const passwordInput = document.getElementById("registerPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const registerBtn = document.getElementById("registerBtn");
const formMessage = document.getElementById("formMessage");

const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clearErrors() {
  nameError.textContent = "";
  emailError.textContent = "";
  passwordError.textContent = "";
  confirmPasswordError.textContent = "";
  AIRent.showMessage(formMessage, "");
}

function validateForm() {
  let isValid = true;

  if (nameInput.value.trim().length < 3) {
    nameError.textContent = "Name must be at least 3 characters long.";
    isValid = false;
  }

  if (!validateEmail(emailInput.value.trim())) {
    emailError.textContent = "Enter a valid email address.";
    isValid = false;
  }

  if (passwordInput.value.trim().length < 6) {
    passwordError.textContent = "Password must be at least 6 characters.";
    isValid = false;
  } else if (!/[A-Z]/.test(passwordInput.value)) {
    passwordError.textContent = "Password must contain one uppercase letter.";
    isValid = false;
  } else if (!/[0-9]/.test(passwordInput.value)) {
    passwordError.textContent = "Password must contain one number.";
    isValid = false;
  }

  if (confirmPasswordInput.value !== passwordInput.value) {
    confirmPasswordError.textContent = "Passwords do not match.";
    isValid = false;
  }

  return isValid;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  if (!validateForm()) {
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Creating account...";

  const result = await AIRent.fetchApi("/api/v1/auth/register", {
    method: "POST",
    body: {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      confirmPassword: confirmPasswordInput.value,
    },
  });

  registerBtn.disabled = false;
  registerBtn.textContent = "Create Account";

  if (!result.ok || !result.data?.success) {
    const message =
      result.data?.error?.message ||
      result.data?.message ||
      "Registration failed. Please try again.";
    AIRent.showMessage(formMessage, message, "error");
    return;
  }

  AIRent.showMessage(
    formMessage,
    result.data.message || "Account created successfully. Redirecting to login...",
    "success",
  );

  window.setTimeout(() => {
    window.location.href = "/html/login.html";
  }, 800);
});
