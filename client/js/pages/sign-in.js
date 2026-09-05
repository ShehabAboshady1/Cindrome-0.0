document.addEventListener("DOMContentLoaded", () => {
  const signInForm = document.getElementById("signInForm");
  const loginInput = document.getElementById("loginInput");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("remember");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  const loginError = document.getElementById("loginError");
  const passwordError = document.getElementById("passwordError");
  const submitBtn = document.getElementById("submitBtn");

  // 1. استرجاع الاسم أو الإيميل المحفوظ سابقاً
  const rememberedIdentifier = localStorage.getItem(
    "cindrome_remembered_identifier",
  );
  if (rememberedIdentifier) {
    loginInput.value = rememberedIdentifier;
    rememberCheckbox.checked = true;
  }

  // 2. إظهار وإخفاء كلمة المرور
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

  // 3. التحقق والتسجيل عند الإرسال
  signInForm.addEventListener("submit", (e) => {
    e.preventDefault();

    let isValid = true;
    const loginVal = loginInput.value.trim();
    const passwordVal = passwordInput.value;

    // تنظيف رسائل الخطأ القديمة
    clearError(loginInput, loginError);
    clearError(passwordInput, passwordError);

    // 🌟 فحص الخانة: هل هي إيميل أم اسم مستخدم؟ 🌟
    if (!loginVal) {
      showError(loginInput, loginError, "Email or username is required");
      isValid = false;
    } else if (loginVal.includes("@")) {
      // المستخدم كتب @، إذن نتأكد من صيغة الإيميل
      if (!isValidEmail(loginVal)) {
        showError(loginInput, loginError, "Please enter a valid email address");
        isValid = false;
      }
    } else {
      // المستخدم كتب نص بدون @، إذن نتأكد من صيغة اليوزر نيم
      if (loginVal.length < 3) {
        showError(
          loginInput,
          loginError,
          "Username must be at least 3 characters",
        );
        isValid = false;
      } else if (!/^[a-zA-Z0-9_]+$/.test(loginVal)) {
        showError(
          loginInput,
          loginError,
          "Username can only contain letters, numbers, and _",
        );
        isValid = false;
      }
    }

    // فحص كلمة السر
    if (!passwordVal) {
      showError(passwordInput, passwordError, "Password is required");
      isValid = false;
    }

    if (!isValid) return;

    // 4. حفظ خيار التذكر في الـ localStorage
    if (rememberCheckbox.checked) {
      localStorage.setItem("cindrome_remembered_identifier", loginVal);
    } else {
      localStorage.removeItem("cindrome_remembered_identifier");
    }

    // تسجيل الدخول التجريبي
    localStorage.setItem("cindrome_logged_in", "true");

    // لو كان المدخل يوزر نيم، بنخزنه كمان لصفحة البروفايل
    if (!loginVal.includes("@")) {
      localStorage.setItem("cindrome_username", loginVal);
    }

    submitBtn.textContent = "Signing in...";
    submitBtn.disabled = true;

    setTimeout(() => {
      window.location.href = "../../index.html";
    }, 800);
  });

  // دالات مساعدة
  function showError(inputEl, errorEl, message) {
    inputEl.closest(".form-group").classList.add("has-error");
    errorEl.textContent = message;
  }

  function clearError(inputEl, errorEl) {
    inputEl.closest(".form-group").classList.remove("has-error");
    errorEl.textContent = "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});
