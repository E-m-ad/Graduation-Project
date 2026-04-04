const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const rememberMeInput = document.getElementById("rememberMe");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const formMessage = document.getElementById("formMessage");

function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function clearErrors() {
  emailError.textContent = "";
  passwordError.textContent = "";
  AIRent.showMessage(formMessage, "");
}

function validateForm() {
  let isValid = true;

  const emailValue = emailInput.value.trim();
  const passwordValue = passwordInput.value.trim();

  if (!emailValue) {
    emailError.textContent = "Email is required.";
    isValid = false;
  } else if (!validateEmail(emailValue)) {
    emailError.textContent = "Please enter a valid email.";
    isValid = false;
  }

  if (!passwordValue) {
    passwordError.textContent = "Password is required.";
    isValid = false;
  } else if (passwordValue.length < 6) {
    passwordError.textContent = "Password must be at least 6 characters.";
    isValid = false;
  }

  return isValid;
}

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearErrors();

  const isValid = validateForm();
  if (!isValid) {
    return;
  }

  const formData = {
    email: emailInput.value.trim(),
    password: passwordInput.value.trim(),
  };

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    const result = await AIRent.fetchApi("/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    if (!result.ok || !result.data?.success) {
      const errorMessage =
        result.data?.error?.message ||
        result.data?.message ||
        "Login failed. Please check your credentials.";
      AIRent.showMessage(formMessage, errorMessage, "error");
      return;
    }

    AIRent.saveSession({
      accessToken: result.data.accessToken,
      remember: rememberMeInput.checked,
    });

    const user = await AIRent.loadCurrentUser(true);
    AIRent.showMessage(formMessage, "Login successful. Redirecting...", "success");

    window.setTimeout(() => {
      if (user?.role === "admin") {
        window.location.href = AIRent.getDefaultAuthenticatedPath(user);
        return;
      }

      AIRent.goToNextPage(AIRent.getDefaultAuthenticatedPath(user));
    }, 500);
  } catch (error) {
    AIRent.showMessage(
      formMessage,
      "Something went wrong. Please try again.",
      "error",
    );
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

(async function initializeLoginPage() {
  const user = await AIRent.loadCurrentUser();
  if (user) {
    window.location.href = AIRent.getDefaultAuthenticatedPath(user);
  }
})();
