document.addEventListener("DOMContentLoaded", function () {
  if (window.OneSpaceAuth && window.OneSpaceAuth.isAuthenticated()) {
    window.location.replace("workspaces.html");
    return;
  }

  const form = document.getElementById("loginForm");
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePassword");
  const toggleIcon = toggleBtn.querySelector("i");
  const loginBtn = document.getElementById("loginBtn");
  const btnText = loginBtn.querySelector(".btn-text");
  const btnLoading = loginBtn.querySelector(".btn-loading");
  const errorAlert = document.getElementById("loginError");

  toggleBtn.addEventListener("click", function () {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    toggleIcon.textContent = type === "password" ? "visibility_off" : "visibility";
    toggleBtn.setAttribute("aria-label", type === "password" ? "Show password" : "Hide password");
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    setLoading(true);
    hideError();

    try {
      const result = await window.OneSpaceAuth.login(identifierInput.value, passwordInput.value);
      if (result && result.success) {
        window.OneSpaceUtils.showSuccess("Welcome back!");
        window.setTimeout(function () {
          window.location.replace("workspaces.html");
        }, 400);
      }
    } catch (err) {
      showError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    btnText.classList.toggle("d-none", isLoading);
    btnLoading.classList.toggle("d-none", !isLoading);
    if (isLoading) btnLoading.classList.remove("hidden");
  }

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove("d-none");
    errorAlert.classList.remove("hidden");
  }

  function hideError() {
    errorAlert.classList.add("d-none");
    errorAlert.textContent = "";
  }

  function showForgotPasswordNotice() {
    showError("Forgot password is not available yet.");
  }
});