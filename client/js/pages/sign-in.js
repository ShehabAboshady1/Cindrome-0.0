document.addEventListener("DOMContentLoaded", () => {
  const loginInput = document.getElementById("loginInput");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("remember");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");

  // 1. استرجاع الاسم أو الإيميل المحفوظ سابقاً
  const rememberedIdentifier = localStorage.getItem("cindrome_remembered_identifier");
  if (rememberedIdentifier && loginInput) {
    loginInput.value = rememberedIdentifier;
    if(rememberCheckbox) rememberCheckbox.checked = true;
  }

  // 2. إظهار وإخفاء كلمة المرور (زرار العين)
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";

      const icon = togglePasswordBtn.querySelector("i");
      if (icon) {
        icon.className = isPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
      }
    });
  }
  // 3. التحقق من وجود خطأ في الرابط (جاي من السيرفر)
  const urlParams = new URLSearchParams(window.location.search);
  const loginError = document.getElementById("loginError");
  const passwordError = document.getElementById("passwordError");

  if (urlParams.has('error') && loginInput && passwordInput) {
    // تلوين الخانات بالأحمر
    loginInput.closest(".form-group").classList.add("has-error");
    passwordInput.closest(".form-group").classList.add("has-error");
    
    // إظهار الرسالة
    if (loginError) loginError.textContent = "Invalid email/username or password.";
  }
  // شيلنا كود الإرسال خالص، هنسيب المتصفح والسيرفر يتصرفوا مع بعض طبيعي!
});