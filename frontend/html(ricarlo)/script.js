// ---------- Validation rules ----------

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

  // Must contain exactly one @, valid format, and end with .edu.ph
  email(value) {
    const v = value.trim().toLowerCase();
    if (!v) return "Email is required.";
    if (!v.includes("@")) return "Email must contain an @ symbol.";
    if ((v.match(/@/g) || []).length > 1) return "Email can only contain one @ symbol.";
    if (/\s/.test(v)) return "Email cannot contain spaces.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Email format is not valid.";
    if (!v.endsWith(".edu.ph")) return "Email must end with .edu.ph (e.g. juan@school.edu.ph).";
    return "";
  },

  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
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
  return message === "";
}

function setStatus(message) {
  $("status").textContent = message;
}

function showSection(name) {
  $("signupSection").hidden = name !== "signup";
  $("loginSection").hidden = name !== "login";
  $("welcomeSection").hidden = name !== "welcome";
  setStatus("");
}

// NOTE: This stores accounts in the browser's localStorage so the demo works
// without a server. A real site must store users and check passwords on a server.
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("users")) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

// Hash password so it isn't saved as plain text (still demo-level only)
async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Sign up ----------

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("signupName").value;
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;

  const results = [
    setError("signupName", validators.name(name)),
    setError("signupEmail", validators.email(email)),
    setError("signupPassword", validators.password(password)),
    setError("signupConfirm", validators.confirm(confirm, password)),
  ];
  if (results.includes(false)) return;

  const users = getUsers();
  if (users[email]) {
    setError("signupEmail", "An account with this email already exists.");
    return;
  }

  users[email] = {
    name: name.trim(),
    passwordHash: await hashPassword(password),
  };
  saveUsers(users);

  $("signupForm").reset();
  showSection("login");
  setStatus("Account created! You can log in now.");
});

// ---------- Log in ----------

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  const okEmail = setError("loginEmail", validators.email(email));
  const okPass = setError("loginPassword", password ? "" : "Password is required.");
  if (!okEmail || !okPass) return;

  const user = getUsers()[email];
  const hash = await hashPassword(password);

  if (!user || user.passwordHash !== hash) {
    setError("loginPassword", "Incorrect email or password.");
    return;
  }

  sessionStorage.setItem("currentUser", email);
  $("loginForm").reset();
  showWelcome(email);
});

// ---------- Session ----------

function showWelcome(email) {
  const user = getUsers()[email];
  if (!user) return showSection("login");
  $("welcomeText").textContent = "Hello, " + user.name + " (" + email + ")";
  showSection("welcome");
}

$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("currentUser");
  showSection("login");
  setStatus("You have been logged out.");
});

// ---------- Switch between forms ----------

$("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("login");
});

$("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("signup");
});

// ---------- Live validation (shows errors after leaving a field) ----------

function liveCheck(inputId, validator) {
  $(inputId).addEventListener("blur", () => setError(inputId, validator()));
}

liveCheck("signupName", () => validators.name($("signupName").value));
liveCheck("signupEmail", () => validators.email($("signupEmail").value));
liveCheck("signupPassword", () => validators.password($("signupPassword").value));
liveCheck("signupConfirm", () =>
  validators.confirm($("signupConfirm").value, $("signupPassword").value)
);
liveCheck("loginEmail", () => validators.email($("loginEmail").value));

// ---------- On page load ----------

const current = sessionStorage.getItem("currentUser");
if (current) showWelcome(current);
