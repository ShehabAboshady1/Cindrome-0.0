document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 🌟 1. تفاعلات نافذة السيرش (الفتح والقفل) 🌟
  // ==========================================
  const searchTriggers = document.querySelectorAll(".search-trigger-btn");
  const searchModal = document.getElementById("searchModal");
  const closeSearchBtn = searchModal
    ? searchModal.querySelector(".close-modal-btn")
    : null;

  if (searchModal) {
    searchTriggers.forEach((btn) => {
      btn.addEventListener("click", () => {
        searchModal.style.display = "flex";
      });
    });

    if (closeSearchBtn) {
      closeSearchBtn.addEventListener("click", () => {
        searchModal.style.display = "none";
      });
    }
  }

  // ==========================================
  // 🌟 1.5. تفاعلات الفلاتر والقوائم 🌟
  // ==========================================

  // أ- تشغيل زراير التصنيف (All, Anime, Movies, Series)
  const gTypePills = document.querySelectorAll(".g-type-pill");
  gTypePills.forEach((pill) => {
    pill.addEventListener("click", function () {
      gTypePills.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");
    });
  });

  // ب- تشغيل زرار الـ Reset
  const gResetBtn = document.querySelector(".g-reset-filter-btn");
  if (gResetBtn) {
    gResetBtn.addEventListener("click", () => {
      gTypePills.forEach((p) => p.classList.remove("active"));
      if (gTypePills[0]) gTypePills[0].classList.add("active");

      // إرجاع القوائم المنسدلة للكلمات الافتراضية
      const defaultGTexts = ["Genre", "Rating", "Sort By", "Year"];
      document
        .querySelectorAll(
          ".g-css-dropdown .g-dropdown-selected span:first-child",
        )
        .forEach((span, index) => {
          if (defaultGTexts[index]) span.textContent = defaultGTexts[index];
        });
    });
  }

  // ج- تشغيل القوائم المنسدلة جوه نافذة السيرش (Dropdowns)
  const gDropdownItems = document.querySelectorAll(
    ".g-css-dropdown .g-dropdown-item",
  );
  gDropdownItems.forEach((item) => {
    item.addEventListener("click", function () {
      const details = this.closest("details");
      const summaryText = details.querySelector(
        ".g-dropdown-selected span:first-child",
      );
      summaryText.textContent = this.textContent;
      details.removeAttribute("open"); // يقفل القائمة بعد الاختيار
    });
  });

  // د- 🌟 تشغيل القوائم المنسدلة العادية جوه نافذة الـ Log (المواسم والحلقات) 🌟
  const regularDropdownItems = document.querySelectorAll(
    ".css-dropdown .dropdown-item",
  );
  regularDropdownItems.forEach((item) => {
    item.addEventListener("click", function () {
      const details = this.closest("details");
      const summaryText = details.querySelector(
        ".dropdown-selected span:first-child",
      );
      if (summaryText) {
        summaryText.textContent = this.textContent;
      }
      details.removeAttribute("open"); // يقفل القائمة بعد الاختيار
    });
  });

  // ==========================================
  // 🌟 2. تفاعلات نافذة الـ Log الداخلي 🌟
  // ==========================================
  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal"); // زرار הـ Hero
  const navLogBtn = document.getElementById("navLogBtn"); // زرار الـ Navbar
  const closeLogBtn = document.getElementById("closeLogModalBtn");
  const cancelLogBtn = document.getElementById("cancelLogBtn");

  const dateInput = document.getElementById("watchDate");
  const reviewText = document.getElementById("reviewText");
  const toggleBtns = document.querySelectorAll("#logModal .icon-toggle-btn");
  const stars = document.querySelectorAll("#logModal .rate-star");
  let currentRating = 0;

  // 🧹 دالة تصفير البيانات عشان الزراير متدخلش في بعض 🧹
  window.resetLogData = function () {
    // تصفير النجوم
    currentRating = 0;
    stars.forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    // تصفير أزرار اللايك والإعادة والحرق
    toggleBtns.forEach((btn) => btn.classList.remove("active", "spoiler-active"));

    // تصفير النصوص والتواريخ
    if (reviewText) reviewText.value = "";
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    // تصفير شريط البحث
    const searchInput = document.querySelector("#logModal .log-global-search input");
    if (searchInput) searchInput.value = "";
  };

  function openLog() {
    if (logModal) logModal.style.display = "flex";
  }

  // 🔴 ربط زرار الـ Hero بالفتح والتصفير
  if (openLogBtn) {
    openLogBtn.addEventListener("click", () => {
      window.resetLogData();
      openLog();
    });
  }

  // 🟢 ربط زرار الـ Navbar بالفتح والتصفير وإظهار شريط البحث إجبارياً
  if (navLogBtn) {
    navLogBtn.addEventListener("click", () => {
      window.resetLogData();
      const logGlobalSearch = document.querySelector("#logModal .log-global-search");
      if (logGlobalSearch) {
        logGlobalSearch.style.display = "flex"; // دايما يظهر السيرش من الناف بار
      }
      openLog();
    });
  }

  function closeLog() {
    if (logModal) logModal.style.display = "none";
  }

  if (closeLogBtn) closeLogBtn.addEventListener("click", closeLog);
  if (cancelLogBtn) cancelLogBtn.addEventListener("click", closeLog);

  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
  });

  // ==========================================
  // 🌟 3. لوجيك النجوم والأيقونات جوه نافذة الـ Log 🌟
  // ==========================================
  
  // تشغيل أزرار التوجل (لايك، إعادة)
  const regularToggles = document.querySelectorAll("#logModal .icon-toggle-btn:not(.spoiler-btn)");
  regularToggles.forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  // تشغيل زرار الحرق
  const spoilerBtn = document.querySelector("#logModal .spoiler-btn");
  if (spoilerBtn) {
    spoilerBtn.addEventListener("click", () =>
      spoilerBtn.classList.toggle("spoiler-active"),
    );
  }

  // نظام تقييم النجوم
  function updateStars(value) {
    stars.forEach((star, index) => {
      star.classList.remove("fa-solid", "fa-regular", "fa-star-half-stroke");
      if (value >= index + 1) {
        star.classList.add("fa-solid", "fa-star");
      } else if (value === index + 0.5) {
        star.classList.add("fa-solid", "fa-star-half-stroke");
      } else {
        star.classList.add("fa-regular", "fa-star");
      }
    });
  }

  stars.forEach((star, index) => {
    star.addEventListener("mousemove", function (e) {
      const rect = this.getBoundingClientRect();
      const isHalf = e.clientX - rect.left < rect.width / 2;
      const hoverValue = index + (isHalf ? 0.5 : 1);
      updateStars(hoverValue);
    });

    star.addEventListener("mouseout", function () {
      updateStars(currentRating);
    });

    star.addEventListener("click", function (e) {
      const rect = this.getBoundingClientRect();
      const isHalf = e.clientX - rect.left < rect.width / 2;
      currentRating = index + (isHalf ? 0.5 : 1);
      updateStars(currentRating);
    });
  });

  // إغلاق قوائم Dropdown المنسدلة للبحث أو اللوج عند النقر في الخارج
  document.addEventListener("click", function (event) {
    const dropdowns = document.querySelectorAll(
      ".css-dropdown, .g-css-dropdown",
    );
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.removeAttribute("open");
      }
    });
  });
});