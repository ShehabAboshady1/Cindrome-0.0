// ==========================================
// CINDROME - GLOBAL MODALS & INTERACTIONS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // 🌟 1. تفاعلات نافذة السيرش (Search Modal) 🌟
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

  // 🌟 2. تفاعلات نافذة الـ Log (Log Modal) 🌟
  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal"); // لو فيه زرار مخصوص في الـ Hero
  const navLogBtn = document.getElementById("navLogBtn"); // زرار الـ Navbar
  const closeLogBtn = document.getElementById("closeLogModalBtn");
  const cancelLogBtn = document.getElementById("cancelLogBtn");

  function openLog() {
    if (logModal) logModal.style.display = "flex";
  }

  function closeLog() {
    if (logModal) logModal.style.display = "none";
  }

  if (openLogBtn) openLogBtn.addEventListener("click", openLog);
  if (navLogBtn) navLogBtn.addEventListener("click", openLog);
  if (closeLogBtn) closeLogBtn.addEventListener("click", closeLog);
  if (cancelLogBtn) cancelLogBtn.addEventListener("click", closeLog);

  // 🌟 3. الإغلاق عند الضغط خارج النوافذ (في الخلفية السودا) 🌟
  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
  });

  // 🌟 4. لوجيك نافذة الـ Log الداخلي (التاريخ والزراير) 🌟
  const dateInput = document.getElementById("watchDate");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  const toggleBtns = document.querySelectorAll(
    "#logModal .icon-toggle-btn:not(.spoiler-btn)",
  );
  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  const spoilerBtn = document.querySelector("#logModal .spoiler-btn");
  if (spoilerBtn) {
    spoilerBtn.addEventListener("click", () =>
      spoilerBtn.classList.toggle("spoiler-active"),
    );
  }

  // 🌟 5. نظام تقييم النجوم (Star Rating) 🌟
  const stars = document.querySelectorAll("#logModal .rate-star");
  let currentRating = 0;

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

  // 🌟 6. إغلاق قوائم Dropdown عند النقر في الخارج 🌟
  document.addEventListener("click", function (event) {
    const dropdowns = document.querySelectorAll(".css-dropdown");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.removeAttribute("open");
      }
    });
  });
});
// =========================================================================
// WATCHLIST TOGGLE LOGIC (Global)
// =========================================================================

async function toggleWatchlist(buttonElement, tmdbId, mediaType) {
  const isHeroBtn = buttonElement.classList.contains("hero-watchlist-btn");

  // حفظ المحتوى القديم عشان لو حصل خطأ نرجعه
  const originalHTML = buttonElement.innerHTML;

  // إظهار حالة التحميل (Spinner)
  if (isHeroBtn) {
    buttonElement.innerHTML = `<span class="default-content"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`;
  } else {
    // الزرار الصغير في الكارت
    buttonElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  }
  buttonElement.disabled = true;

  try {
    // إرسال الطلب للسيرفر بتاعنا
    const response = await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    const data = await response.json();

    if (response.status === 200) {
      buttonElement.classList.toggle("added");

      if (buttonElement.classList.contains("mini-bar-btn")) {
        const isAdded = buttonElement.classList.contains("added");
        // نستخدم الـ SVGs الأصلية بتاعتك للـ + و الـ -
        const minusIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        const plusIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

        buttonElement.innerHTML = isAdded ? minusIcon : plusIcon;
        buttonElement.setAttribute(
          "title",
          isAdded ? "Remove from Watchlist" : "Add to Watchlist",
        );
      } else {
        buttonElement.innerHTML = originalHTML;
      }
    }
  } catch (error) {
    console.error("Network error:", error);
    alert("Failed to connect to the server.");
    buttonElement.innerHTML = originalHTML;
  } finally {
    // نرجع نشغل الزرار تاني سواء نجح أو فشل
    buttonElement.disabled = false;
  }
}
// =========================================================================
// LIKE MEDIA TOGGLE LOGIC (Global)
// =========================================================================

async function toggleLike(buttonElement, tmdbId, mediaType) {
  const originalHTML = buttonElement.innerHTML;

  // إظهار اللودينج
  buttonElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  buttonElement.disabled = true;

  try {
    const response = await fetch("/api/like/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    const data = await response.json();

    if (response.status === 200) {
      buttonElement.classList.toggle("liked");

      // لو الزرار ده جوه كارت الوتش ليست (عنده كلاس btn-fav)
      if (buttonElement.classList.contains("btn-fav")) {
        // هنبدل الكلاس اللي بيغير اللون للـ Accent Teal
        buttonElement.classList.toggle("is-favorited");
        // ونرجع الـ SVG الأصلي بتاعك مكان علامة التحميل (Spinner) من غير ما نغيره
        buttonElement.innerHTML = originalHTML;
      } else {
        // ده بتاع الهيرو اللي في صفحة details (بيستخدم FontAwesome)
        const isLiked = buttonElement.classList.contains("liked");
        buttonElement.innerHTML = `<i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
      }
    }
  } catch (error) {
    console.error("Network error:", error);
    alert("Failed to connect to the server.");
    buttonElement.innerHTML = originalHTML;
  } finally {
    buttonElement.disabled = false;
  }
}
