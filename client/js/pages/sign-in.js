document.addEventListener("DOMContentLoaded", () => {
  const loginInput = document.getElementById("loginInput");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("remember");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");

  // Restore remembered username or email from localStorage
  const rememberedIdentifier = localStorage.getItem(
    "cindrome_remembered_identifier",
  );
  if (rememberedIdentifier && loginInput) {
    loginInput.value = rememberedIdentifier;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  // Toggle password visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";

      const icon = togglePasswordBtn.querySelector("i");
      if (icon) {
        icon.className = isPassword
          ? "fa-regular fa-eye-slash"
          : "fa-regular fa-eye";
      }
    });
  }

  // Check URL query parameters for authentication errors
  const urlParams = new URLSearchParams(window.location.search);
  const loginError = document.getElementById("loginError");

  if (urlParams.has("error") && loginInput && passwordInput) {
    loginInput.closest(".form-group").classList.add("has-error");
    passwordInput.closest(".form-group").classList.add("has-error");

    if (loginError) {
      loginError.textContent = "Invalid email/username or password.";
    }
  }
});
