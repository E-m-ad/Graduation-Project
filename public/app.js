const STORAGE_KEY = "user-api-test-page.access-token";

const accessTokenField = document.querySelector("#access-token");
const resetTokenField = document.querySelector("#reset-token");
const output = document.querySelector("#response-output");
const statusPill = document.querySelector("#status-pill");
const publicUserIdField = document.querySelector("#public-user-id");
const loginEmailField = document.querySelector("#login-email");

const currentUserAvatar = document.querySelector("#current-user-avatar");
const currentUserName = document.querySelector("#current-user-name");
const currentUserEmail = document.querySelector("#current-user-email");
const currentUserMeta = document.querySelector("#current-user-meta");

const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const forgotForm = document.querySelector("#forgot-form");
const resetForm = document.querySelector("#reset-form");
const updateProfileForm = document.querySelector("#update-profile-form");
const changePasswordForm = document.querySelector("#change-password-form");
const uploadAvatarForm = document.querySelector("#upload-avatar-form");

const saveTokenButton = document.querySelector("#save-token");
const clearTokenButton = document.querySelector("#clear-token");
const profileButton = document.querySelector("#profile-button");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");
const publicProfileButton = document.querySelector("#public-profile-button");
const publicProductsButton = document.querySelector("#public-products-button");
const publicReviewsButton = document.querySelector("#public-reviews-button");

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
  const values = Object.fromEntries(new FormData(form).entries());

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value !== "string" || value.trim() !== ""),
  );
}

function getFormValue(form, fieldName) {
  return form.elements.namedItem(fieldName);
}

function getPublicUserId() {
  return publicUserIdField.value.trim();
}

function setCurrentUser(user) {
  if (!user) {
    currentUserName.textContent = "No user loaded";
    currentUserEmail.textContent =
      "Log in and load the profile to see your details.";
    currentUserMeta.textContent =
      "Role and verification state will appear here.";
    currentUserAvatar.hidden = true;
    currentUserAvatar.src = "";
    return;
  }

  currentUserName.textContent = user.name || "Unnamed user";
  currentUserEmail.textContent = [
    user.email || "No email",
    user.id ? `ID: ${user.id}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  currentUserMeta.textContent = [
    user.role ? `Role: ${user.role}` : null,
    typeof user.isVerified === "boolean"
      ? user.isVerified
        ? "Verified"
        : "Not verified"
      : null,
    typeof user.isActive === "boolean"
      ? user.isActive
        ? "Active"
        : "Inactive"
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (user.avatarUrl) {
    currentUserAvatar.src = user.avatarUrl;
    currentUserAvatar.hidden = false;
  } else {
    currentUserAvatar.hidden = true;
    currentUserAvatar.src = "";
  }

  if (user.id) {
    publicUserIdField.value = user.id;
  }

  getFormValue(updateProfileForm, "name").value = user.name ?? "";
  getFormValue(updateProfileForm, "phone").value = user.phone ?? "";
  getFormValue(updateProfileForm, "city").value = user.city ?? "";
  getFormValue(updateProfileForm, "address").value = user.address ?? "";
  getFormValue(updateProfileForm, "bio").value = user.bio ?? "";
}

async function apiRequest(label, url, options = {}) {
  const requestOptions = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {},
  };

  if (options.formData) {
    requestOptions.body = options.formData;
  } else if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
    requestOptions.headers["Content-Type"] = "application/json";
  }

  if (options.withAuth) {
    const token = getAccessToken();

    if (!token) {
      setStatus("error", "Missing token");
      renderResponse(`${label} skipped`, {
        success: false,
        message: "Login first or paste an access token.",
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

    renderResponse(
      `${label} -> ${response.status} ${response.statusText}`,
      data,
    );
    setStatus(
      response.ok ? "success" : "error",
      response.ok ? "Success" : "Request failed",
    );

    if (typeof options.onSuccess === "function" && response.ok) {
      await options.onSuccess(data);
    }

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

async function loadMyProfile() {
  return apiRequest("Get profile", "/api/v1/users/me", {
    method: "GET",
    withAuth: true,
    onSuccess: async (data) => {
      setCurrentUser(data?.data ?? null);
    },
  });
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
  const result = await apiRequest("Login", "/api/v1/auth/login", {
    method: "POST",
    body: formToObject(loginForm),
  });

  if (result?.response.ok) {
    await loadMyProfile();
  }
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

updateProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await apiRequest("Update profile", "/api/v1/users/me", {
    method: "PUT",
    body: formToObject(updateProfileForm),
    withAuth: true,
  });

  if (result?.response.ok) {
    await loadMyProfile();
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await apiRequest(
    "Change password",
    "/api/v1/users/change-password",
    {
      method: "PUT",
      body: formToObject(changePasswordForm),
      withAuth: true,
    },
  );

  if (result?.response.ok) {
    changePasswordForm.reset();
  }
});

uploadAvatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadAvatarForm);
  const avatarFile = formData.get("avatar");

  if (!(avatarFile instanceof File) || avatarFile.size === 0) {
    setStatus("error", "Missing file");
    renderResponse("Upload avatar skipped", {
      success: false,
      message: "Select an image file first.",
    });
    return;
  }

  const result = await apiRequest("Upload avatar", "/api/v1/users/upload-avatar", {
    method: "POST",
    formData,
    withAuth: true,
  });

  if (result?.response.ok) {
    uploadAvatarForm.reset();
    await loadMyProfile();
  }
});

saveTokenButton.addEventListener("click", () => {
  setAccessToken(getAccessToken());
  setStatus("success", "Token saved");
  renderResponse("Access token saved", {
    success: true,
    message: "The access token was stored in local storage.",
  });
});

clearTokenButton.addEventListener("click", () => {
  setAccessToken("");
  setCurrentUser(null);
  setStatus("success", "Token cleared");
  renderResponse("Access token cleared", {
    success: true,
    message: "The access token was removed from local storage.",
  });
});

profileButton.addEventListener("click", async () => {
  await loadMyProfile();
});

refreshButton.addEventListener("click", async () => {
  const result = await apiRequest("Refresh token", "/api/v1/auth/refresh-token", {
    method: "POST",
  });

  if (result?.response.ok && getAccessToken()) {
    await loadMyProfile();
  }
});

logoutButton.addEventListener("click", async () => {
  const result = await apiRequest("Logout", "/api/v1/auth/logout", {
    method: "POST",
  });

  if (result?.response.ok) {
    setAccessToken("");
    setCurrentUser(null);
  }
});

publicProfileButton.addEventListener("click", async () => {
  const userId = getPublicUserId();

  if (!userId) {
    setStatus("error", "Missing user ID");
    renderResponse("Public profile skipped", {
      success: false,
      message: "Enter a user ID first.",
    });
    return;
  }

  await apiRequest(
    "Get public profile",
    `/api/v1/public/users/${encodeURIComponent(userId)}`,
  );
});

publicProductsButton.addEventListener("click", async () => {
  const userId = getPublicUserId();

  if (!userId) {
    setStatus("error", "Missing user ID");
    renderResponse("Public products skipped", {
      success: false,
      message: "Enter a user ID first.",
    });
    return;
  }

  await apiRequest(
    "Get public products",
    `/api/v1/public/users/${encodeURIComponent(userId)}/products`,
  );
});

publicReviewsButton.addEventListener("click", async () => {
  const userId = getPublicUserId();

  if (!userId) {
    setStatus("error", "Missing user ID");
    renderResponse("Public reviews skipped", {
      success: false,
      message: "Enter a user ID first.",
    });
    return;
  }

  await apiRequest(
    "Get public reviews",
    `/api/v1/public/users/${encodeURIComponent(userId)}/reviews`,
  );
});

setAccessToken(localStorage.getItem(STORAGE_KEY) ?? "");
if (loginEmailField.value) {
  getFormValue(forgotForm, "email").value = loginEmailField.value;
}
loginEmailField.addEventListener("input", () => {
  getFormValue(forgotForm, "email").value = loginEmailField.value.trim();
});
setCurrentUser(null);
setStatus("idle", "Idle");
