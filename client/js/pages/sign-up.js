document.addEventListener("DOMContentLoaded", () => {
  const signUpForm = document.getElementById("signUpForm");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const termsCheckbox = document.getElementById("terms");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const submitBtn = document.getElementById("submitBtn");

  // عناصر رسائل الخطأ
  const usernameError = document.getElementById("usernameError");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const termsError = document.getElementById("termsError");

  // عناصر فحص كلمة المرور
  const reqLength = document.getElementById("req-length");
  const reqUppercase = document.getElementById("req-uppercase");
  const reqNumberSpecial = document.getElementById("req-number-special");

  // ==================================================
  // 🌟 1. إظهار وإخفاء كلمة المرور
  // ==================================================
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

  // ==================================================
  // 🌟 2. الفحص الحي لقوة كلمة المرور (Live Validation)
  // ==================================================
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

  // ==================================================
  // 🌟 3. التحقق عند الضغط على إنشاء حساب (Submit)
  // ==================================================
  signUpForm.addEventListener("submit", (e) => {
    e.preventDefault();

    let isFormValid = true;
    const usernameVal = usernameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const passwordVal = passwordInput.value;

    // إعادة ضبط الأخطاء
    clearError(usernameInput, usernameError);
    clearError(emailInput, emailError);
    clearError(passwordInput, passwordError);
    if (termsError) termsError.classList.remove("show");

    // فحص اسم المستخدم (3 أحرف على الأقل، أحرف وأرقام وشرطة سفلية)
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

    // فحص البريد الإلكتروني
    if (!emailVal) {
      showError(emailInput, emailError, "Email address is required");
      isFormValid = false;
    } else if (!isValidEmail(emailVal)) {
      showError(emailInput, emailError, "Enter a valid email address");
      isFormValid = false;
    }

    // فحص شروط كلمة المرور
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

    // فحص الموافقة على الشروط
    if (!termsCheckbox.checked) {
      if (termsError) {
        termsError.textContent = "You must agree to the Terms & Policy";
        termsError.classList.add("show");
      }
      isFormValid = false;
    }

    if (!isFormValid) return;

    // ==================================================
    // 🌟 4. حفظ بيانات المستخدم والدخول (localStorage)
    // ==================================================
    localStorage.setItem("cindrome_username", usernameVal);
    localStorage.setItem("cindrome_email", emailVal);
    localStorage.setItem("cindrome_logged_in", "true");

    submitBtn.textContent = "Creating Account...";
    submitBtn.disabled = true;

    setTimeout(() => {
      window.location.href = "../../index.html";
    }, 900);
  });

  // ==================================================
  // 🌟 5. دوال مساعدة
  // ==================================================
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
