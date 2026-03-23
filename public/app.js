const STORAGE_KEY = "auth-test-console.access-token";

const accessTokenField = document.querySelector("#access-token");
const resetTokenField = document.querySelector("#reset-token");
const output = document.querySelector("#response-output");
const statusPill = document.querySelector("#status-pill");

const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const forgotForm = document.querySelector("#forgot-form");
const resetForm = document.querySelector("#reset-form");

const saveTokenButton = document.querySelector("#save-token");
const clearTokenButton = document.querySelector("#clear-token");
const profileButton = document.querySelector("#profile-button");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");

function setStatus(state, message) {
  statusPill.dataset.state = state;
  statusPill.textContent = message;
}

function setAccessToken(token) {
  const trimmedToken = token.trim();

  accessTokenField.value = trimmedToken;

  if (trimmedToken) {
    localStorage.setItem(STORAGE_KEY, trimmedToken);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getAccessToken() {
  return accessTokenField.value.trim();
}

function renderResponse(title, payload) {
  output.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function apiRequest(label, url, options = {}) {
  const requestOptions = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {},
  };

  if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
    requestOptions.headers["Content-Type"] = "application/json";
  }

  if (options.withAuth) {
    const token = getAccessToken();

    if (!token) {
      setStatus("error", "Missing token");
      renderResponse(`${label} skipped`, {
        success: false,
        message: "Paste or generate an access token first.",
      });
      return null;
    }

    requestOptions.headers.Authorization = `Bearer ${token}`;
  }

  setStatus("working", "Working...");

  try {
    const response = await fetch(url, requestOptions);
    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { raw: text };
    }

    if (data?.accessToken) {
      setAccessToken(data.accessToken);
    }

    if (data?.resetToken) {
      resetTokenField.value = data.resetToken;
    }

    renderResponse(`${label} -> ${response.status} ${response.statusText}`, data);
    setStatus(response.ok ? "success" : "error", response.ok ? "Success" : "Request failed");

    return { response, data };
  } catch (error) {
    console.error(error);
    setStatus("error", "Network error");
    renderResponse(`${label} -> network error`, {
      success: false,
      message: error.message,
    });
    return null;
  }
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("Register", "/api/v1/auth/register", {
    method: "POST",
    body: formToObject(registerForm),
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("Login", "/api/v1/auth/login", {
    method: "POST",
    body: formToObject(loginForm),
  });
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("Forgot password", "/api/v1/auth/forgot-password", {
    method: "POST",
    body: formToObject(forgotForm),
  });
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await apiRequest("Reset password", "/api/v1/auth/reset-password", {
    method: "POST",
    body: formToObject(resetForm),
  });
});

saveTokenButton.addEventListener("click", () => {
  setAccessToken(getAccessToken());
  setStatus("success", "Token saved");
  renderResponse("Access token saved", {
    success: true,
    message: "The access token is now stored in local storage.",
  });
});

clearTokenButton.addEventListener("click", () => {
  setAccessToken("");
  setStatus("success", "Token cleared");
  renderResponse("Access token cleared", {
    success: true,
    message: "The stored access token was removed.",
  });
});

profileButton.addEventListener("click", async () => {
  await apiRequest("Get profile", "/api/v1/users/me", {
    method: "GET",
    withAuth: true,
  });
});

refreshButton.addEventListener("click", async () => {
  await apiRequest("Refresh token", "/api/v1/auth/refresh-token", {
    method: "POST",
  });
});

logoutButton.addEventListener("click", async () => {
  const result = await apiRequest("Logout", "/api/v1/auth/logout", {
    method: "POST",
  });

  if (result?.response.ok) {
    setAccessToken("");
  }
});

setAccessToken(localStorage.getItem(STORAGE_KEY) ?? "");
setStatus("idle", "Idle");
