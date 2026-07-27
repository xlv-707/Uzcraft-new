const container = document.querySelector(".container");
const registerBtn = document.querySelector(".register-btn");
const loginBtn = document.querySelector(".login-btn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

let activeSettings = null;

function getCore() {
    return window.UZCRAFT || {};
}

function getSettings() {
    const core = getCore();
    if (activeSettings) return activeSettings;
    return core.getLocalSettings ? core.getLocalSettings() : {};
}

function getUserManagement() {
    return {
        loginEnabled: true,
        registrationEnabled: true,
        guestCheckoutEnabled: true,
        ...(getSettings().userManagement || {})
    };
}

function getSecurity() {
    return {
        passwordLength: 8,
        ...(getSettings().security || {})
    };
}

function showFormMessage(form, message, type = "error") {
    if (!form) return;
    let box = form.querySelector(".form-settings-message");
    if (!box) {
        box = document.createElement("p");
        box.className = "form-settings-message";
        box.style.cssText = "margin:10px 0 0;font-size:13px;font-weight:600;text-align:center;";
        form.appendChild(box);
    }
    box.textContent = message;
    box.style.color = type === "success" ? "#0f7b3a" : "#cc3a3a";
}

function clearFormMessage(form) {
    form?.querySelector(".form-settings-message")?.remove();
}

function setFormEnabled(form, enabled, message) {
    if (!form) return;
    form.querySelectorAll("input, button[type='submit']").forEach((element) => {
        element.disabled = !enabled;
        element.style.opacity = enabled ? "" : "0.55";
        element.style.cursor = enabled ? "" : "not-allowed";
    });
    if (enabled) {
        clearFormMessage(form);
    } else {
        showFormMessage(form, message);
    }
}

function applyAccessRules() {
    const access = getUserManagement();
    const security = getSecurity();
    const registerPassword = document.getElementById("registerPassword");

    if (registerPassword) {
        registerPassword.minLength = Number(security.passwordLength) || 8;
    }

    setFormEnabled(loginForm, Boolean(access.loginEnabled), "Login admin tomonidan vaqtincha o'chirilgan.");
    setFormEnabled(registerForm, Boolean(access.registrationEnabled), "Registration admin tomonidan vaqtincha o'chirilgan.");
}

async function waitForSettings() {
    const core = getCore();
    if (core.ready) {
        await core.ready;
    }
    activeSettings = getCore().getLocalSettings ? getCore().getLocalSettings() : {};
    applyAccessRules();
}

function notifyError(title, details) {
    const core = getCore();
    if (core.notifyError) {
        core.notifyError(title, details, "login");
    }
}

async function request(path, payload) {
    const core = getCore();
    if (core.api) {
        return core.api(path, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    const response = await fetch(`http://localhost:3000${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "Server error");
    }
    return data;
}

registerBtn?.addEventListener("click", () => {
    container?.classList.add("active");
});

loginBtn?.addEventListener("click", () => {
    container?.classList.remove("active");
});

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const access = getUserManagement();
    if (!access.loginEnabled) {
        showFormMessage(loginForm, "Login admin tomonidan yopilgan.");
        return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
        const data = await request("/api/login", { email, password });

        if (!data.success) {
            throw new Error(data.message || "Login failed");
        }

        localStorage.setItem("currentUser", JSON.stringify(data.user));
        clearFormMessage(loginForm);

        window.location.href = data.user.role === "admin"
            ? "/admin/html/dashboard.html"
            : "/client/html/index.html";
    } catch (error) {
        console.error("Login failed:", error);
        notifyError("Login failed", error.message);
        showFormMessage(loginForm, error.message || "Server bilan bog'lanib bo'lmadi");
    }
});

registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const access = getUserManagement();
    const security = getSecurity();
    const minPasswordLength = Number(security.passwordLength) || 8;

    if (!access.registrationEnabled) {
        showFormMessage(registerForm, "Registration admin tomonidan yopilgan.");
        return;
    }

    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!username || !email || !password) {
        showFormMessage(registerForm, "Barcha maydonlarni to'ldiring.");
        return;
    }

    if (password.length < minPasswordLength) {
        showFormMessage(registerForm, `Password kamida ${minPasswordLength} ta belgidan iborat bo'lishi kerak.`);
        return;
    }

    try {
        const data = await request("/api/register", { username, email, password });

        if (!data.success) {
            throw new Error(data.message || "Registration failed");
        }

        registerForm.reset();
        container?.classList.remove("active");
        showFormMessage(loginForm, "Ro'yxatdan o'tdingiz. Endi login qiling.", "success");
        clearFormMessage(registerForm);
    } catch (error) {
        console.error("Registration failed:", error);
        notifyError("User save failed", error.message);
        showFormMessage(registerForm, error.message || "Server bilan bog'lanib bo'lmadi");
    }
});

function handleCredentialResponse(response) {
    console.log("Google Login:", response);
    showFormMessage(loginForm, "Google login keyinroq ulanadi.");
}

window.handleCredentialResponse = handleCredentialResponse;

document.addEventListener("DOMContentLoaded", waitForSettings);
