// Shared by login.html and signup.html (load after main.js, before the page's own script)

// ---------- Validation rules (client-side; the server checks everything again) ----------

const validators = {
  // Letters (including accents), spaces, hyphens, apostrophes, periods. 2-60 chars.
  name(value) {
    const v = value.trim();
    if (!v) return "Name is required.";
    if (v.length < 2) return "Name must be at least 2 characters.";
    if (v.length > 60) return "Name is too long (max 60 characters).";
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s.'-]*$/.test(v))
      return "Name can only contain letters, spaces, periods, hyphens and apostrophes.";
    return "";
  },

  emailFormat(value) {
    const v = value.trim().toLowerCase();
    if (!v) return "Email is required.";
    if (/\s/.test(v)) return "Email cannot contain spaces.";
    if ((v.match(/@/g) || []).length !== 1) return "Email must contain exactly one @ symbol.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Email format is not valid.";
    return "";
  },

  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number (the server only requires 8+ characters)
  password(value) {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-z]/.test(value)) return "Password needs a lowercase letter.";
    if (!/[A-Z]/.test(value)) return "Password needs an uppercase letter.";
    if (!/[0-9]/.test(value)) return "Password needs a number.";
    return "";
  },

  confirm(value, original) {
    if (!value) return "Please confirm your password.";
    if (value !== original) return "Passwords do not match.";
    return "";
  },
};

// ---------- Helpers ----------

const $ = (id) => document.getElementById(id);

function setError(fieldId, message) {
  $(fieldId + "Error").textContent = message;
  $(fieldId).setAttribute("aria-invalid", message === "" ? "false" : "true");
  return message === "";
}

function setFormError(id, message) {
  $(id).textContent = message;
}

function setStatus(message) {
  $("status").textContent = message;
}

// Errors appear on submit. After that, a field re-checks as you type so its error clears
// the moment it is fixed.
function liveCheck(inputId, validator) {
  ["input", "change"].forEach((type) =>
    $(inputId).addEventListener(type, () => {
      if ($(inputId + "Error").textContent !== "") setError(inputId, validator());
    })
  );
}

function goTo(url) {
  window.location.href = url;
}

// ---------- Talking to the backend ----------

class NetworkError extends Error {}

async function request(method, path, body, token) {
  const url = API_URL + path;               // API_URL comes from main.js
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new NetworkError("Can't reach the server. Make sure the backend is running.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Something went wrong. Please try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- Session (the token is also read by auditlog.html) ----------

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// Where each kind of user lands after logging in or signing up
function homeFor(user) {
  if (user.role === "admin") return "admin-dashboard.html";
  if (user.role === "student") return "student.html";
  return "events.html";
}
