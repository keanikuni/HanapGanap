// signup.html - needs main.js and auth.js loaded first

// Already logged in? The login page shows the "you're in" view with a log out button.
if (localStorage.getItem("token") && getSavedUser()) goTo("login.html");

const required = (label, max = 100) => (value) => {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (v.length > max) return `${label} is too long (max ${max} characters).`;
  return "";
};

// Role-specific fields (same limits as authRoutes.js)
const fieldChecks = {
  signupUniversity: (v) => (v ? "" : "Choose your university."),
  signupStudentNumber: required("Student number"),
  signupCourse: required("Course / program"),
  signupYear: (v) => (v ? "" : "Choose your year level."),
  signupOrgName: required("Organization name", 150),
  signupContact: required("Contact number", 30),
  signupAffiliation: (v) => (v.trim().length > 150 ? "Too long (max 150 characters)." : ""),
};

const ROLE_FIELDS = {
  student: ["signupUniversity", "signupStudentNumber", "signupCourse", "signupYear"],
  organizer: ["signupUniversity", "signupOrgName"],
  guest: ["signupContact", "signupAffiliation"],
};

// ---------- Universities and role-specific fields ----------

let universities = [];

async function loadUniversities() {
  const select = $("signupUniversity");

  try {
    universities = await request("GET", "/universities");

    select.innerHTML = "";

    const first = document.createElement("option");
    first.value = "";
    first.textContent = "University";
    first.disabled = true;
    first.selected = true;
    select.appendChild(first);

    universities.forEach((u) => {
      const option = document.createElement("option");
      option.value = u.id;
      option.textContent = u.name; // textContent, so names can't inject HTML
      select.appendChild(option);
    });
  } catch (err) {
    console.error("loadUniversities failed:", err);
    select.innerHTML = "";
    const fallback = document.createElement("option");
    fallback.value = "";
    fallback.textContent = "Can't load universities";
    select.appendChild(fallback);
  }
}

const role = () => $("signupRole").value;
const needsUniversity = () => role() === "student" || role() === "organizer";

function selectedDomain() {
  const u = universities.find((x) => String(x.id) === $("signupUniversity").value);
  return u ? u.emailDomain.toLowerCase() : "";
}

function updateEmailHints() {
  const domain = needsUniversity() ? selectedDomain() : "";
  const text = needsUniversity() ? (domain ? `School email (@${domain})` : "School email") : "Email";
  $("signupEmail").placeholder = text;
  document.querySelector('label[for="signupEmail"]').textContent = text;
}

function applyRole() {
  document.querySelectorAll("#signupForm [data-roles]").forEach((group) => {
    group.hidden = !group.dataset.roles.split(" ").includes(role());
  });
  Object.keys(fieldChecks).forEach((id) => setError(id, ""));
  setFormError("signupFormError", "");
  updateEmailHints();
}

function signupEmailError() {
  const value = $("signupEmail").value;
  const problem = validators.emailFormat(value);
  if (problem) return problem;
  if (needsUniversity()) {
    const domain = selectedDomain();
    if (!domain) return "Choose your university first.";
    if (!value.trim().toLowerCase().endsWith("@" + domain)) return `Use your @${domain} email.`;
  }
  return "";
}

// ---------- Submit ----------

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const r = role();
  const name = $("signupName").value;
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;

  setFormError("signupFormError", "");

  const results = [
    setError("signupName", validators.name(name)),
    setError("signupEmail", signupEmailError()),
    ...ROLE_FIELDS[r].map((id) => setError(id, fieldChecks[id]($(id).value))),
    setError("signupPassword", validators.password(password)),
    setError("signupConfirm", validators.confirm(confirm, password)),
  ];
  if (results.includes(false)) return;

  const body = { fullName: name.trim(), email, password, role: r };
  if (r === "student") {
    Object.assign(body, {
      universityId: Number($("signupUniversity").value),
      studentNumber: $("signupStudentNumber").value.trim(),
      courseProgram: $("signupCourse").value.trim(),
      yearLevel: $("signupYear").value,
    });
  } else if (r === "organizer") {
    Object.assign(body, {
      universityId: Number($("signupUniversity").value),
      orgName: $("signupOrgName").value.trim(),
    });
  } else {
    body.contactNumber = $("signupContact").value.trim();
    const affiliation = $("signupAffiliation").value.trim();
    if (affiliation) body.schoolOrAffiliation = affiliation;   // the server rejects empty text
  }

  const button = $("signupForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await request("POST", "/auth/register", body);   // replies { token, user }
    saveSession(data.token, data.user);
    goTo("events.html");
  } catch (err) {
    if (err.status === 409) setError("signupEmail", err.message);
    else setFormError("signupFormError", err.message);
    button.disabled = false;
  }
});

// ---------- Live validation ----------

liveCheck("signupName", () => validators.name($("signupName").value));
liveCheck("signupEmail", signupEmailError);
liveCheck("signupPassword", () => validators.password($("signupPassword").value));
liveCheck("signupConfirm", () => validators.confirm($("signupConfirm").value, $("signupPassword").value));
Object.keys(fieldChecks).forEach((id) => liveCheck(id, () => fieldChecks[id]($(id).value)));

// If the password changes, refresh the "passwords match" message too
$("signupPassword").addEventListener("input", () => {
  if ($("signupConfirmError").textContent !== "") {
    setError("signupConfirm", validators.confirm($("signupConfirm").value, $("signupPassword").value));
  }
});

// Role or university changed: show the right fields, update the email hint
$("signupRole").addEventListener("change", applyRole);
$("signupUniversity").addEventListener("change", () => {
  updateEmailHints();
  if ($("signupEmailError").textContent !== "") setError("signupEmail", signupEmailError());
});

// ---------- On page load ----------

applyRole();
loadUniversities();