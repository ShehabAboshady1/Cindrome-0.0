document.addEventListener("DOMContentLoaded", () => {
  const signUpForm = document.getElementById("signUpForm");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const termsCheckbox = document.getElementById("terms");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const submitBtn = document.getElementById("submitBtn");

  const usernameError = document.getElementById("usernameError");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const termsError = document.getElementById("termsError");

  const reqLength = document.getElementById("req-length");
  const reqUppercase = document.getElementById("req-uppercase");
  const reqNumberSpecial = document.getElementById("req-number-special");

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

  // Live password strength validation
  function validatePasswordRequirements(val) {
    const hasLength = val.length >= 8;
    const hasUppercase = /[A-Z]/.test(val);
    const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(val);

    updateRequirement(reqLength, hasLength);
    updateRequirement(reqUppercase, hasUppercase);
    updateRequirement(reqNumberSpecial, hasNumberOrSpecial);

    return hasLength && hasUppercase && hasNumberOrSpecial;
  }

  function updateRequirement(el, isValid) {
    if (!el) return;
    const icon = el.querySelector(".req-icon");
    if (isValid) {
      el.classList.add("valid");
      if (icon) icon.textContent = "✓";
    } else {
      el.classList.remove("valid");
      if (icon) icon.textContent = "•";
    }
  }

  passwordInput.addEventListener("input", () => {
    validatePasswordRequirements(passwordInput.value);
    if (passwordInput.value.length > 0) {
      clearError(passwordInput, passwordError);
    }
  });

  // Client-side form submission validation
  signUpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let isFormValid = true;
    const usernameVal = usernameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const passwordVal = passwordInput.value;

    clearError(usernameInput, usernameError);
    clearError(emailInput, emailError);
    clearError(passwordInput, passwordError);
    if (termsError) termsError.classList.remove("show");

    // Username validation: minimum 3 alphanumeric characters or underscores
    if (!usernameVal) {
      showError(usernameInput, usernameError, "Username is required");
      isFormValid = false;
    } else if (usernameVal.length < 3) {
      showError(usernameInput, usernameError, "Min 3 characters");
      isFormValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(usernameVal)) {
      showError(usernameInput, usernameError, "Letters, numbers, and _ only");
      isFormValid = false;
    }

    // Email format validation
    if (!emailVal) {
      showError(emailInput, emailError, "Email address is required");
      isFormValid = false;
    } else if (!isValidEmail(emailVal)) {
      showError(emailInput, emailError, "Enter a valid email address");
      isFormValid = false;
    }

    // Password requirements check
    const isPasswordSecure = validatePasswordRequirements(passwordVal);
    if (!passwordVal) {
      showError(passwordInput, passwordError, "Password is required");
      isFormValid = false;
    } else if (!isPasswordSecure) {
      showError(
        passwordInput,
        passwordError,
        "Password does not meet all requirements",
      );
      isFormValid = false;
    }

    // Terms and conditions acceptance check
    if (!termsCheckbox.checked) {
      if (termsError) {
        termsError.textContent = "You must agree to the Terms & Policy";
        termsError.classList.add("show");
      }
      isFormValid = false;
    }

    if (!isFormValid) return;

    submitBtn.textContent = "Creating Account...";
    submitBtn.disabled = true;

    signUpForm.submit();
  });

  // Validation helpers
  function showError(inputEl, errorEl, message) {
    inputEl.closest(".form-group").classList.add("has-error");
    if (errorEl) errorEl.textContent = message;
  }

  function clearError(inputEl, errorEl) {
    inputEl.closest(".form-group").classList.remove("has-error");
    if (errorEl) errorEl.textContent = "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});
