// login.html - needs main.js and auth.js loaded first

function showSection(name) {
  $("loginSection").hidden = name !== "login";
  $("welcomeSection").hidden = name !== "welcome";
  setStatus("");
}

// Shown when someone who is already logged in opens this page
function showWelcome(user) {
  $("welcomeText").textContent = `Logged in as ${user.fullName} (${user.email}) · ${user.role}`;
  $("continueLink").href = homeFor(user);
  showSection("welcome");
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  setFormError("loginFormError", "");
  const okEmail = setError("loginEmail", validators.emailFormat(email));
  const okPass = setError("loginPassword", password ? "" : "Password is required.");
  if (!okEmail || !okPass) return;

  const button = $("loginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await request("POST", "/auth/login", { email, password });   // { token, user }
    saveSession(data.token, data.user);
    goTo(homeFor(data.user));
  } catch (err) {
    if (err.status === 401) setError("loginPassword", err.message);
    else setFormError("loginFormError", err.message);
    button.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", () => {
  clearSession();
  showSection("login");
  setStatus("You have been logged out.");
});

liveCheck("loginEmail", () => validators.emailFormat($("loginEmail").value));
liveCheck("loginPassword", () => ($("loginPassword").value ? "" : "Password is required."));

// ---------- On page load ----------

(async function restoreSession() {
  const token = localStorage.getItem("token");
  const saved = getSavedUser();
  if (!token || !saved) return;

  try {
    const me = await request("GET", "/auth/me", null, token);   // checks the token is still valid
    const user = { id: me.id, fullName: me.fullName, email: me.email, role: me.role };
    saveSession(token, user);
    showWelcome(user);
  } catch (err) {
    if (err instanceof NetworkError) showWelcome(saved);   // offline: trust what we saved
    else clearSession();                                    // 401: token expired
  }
})();
