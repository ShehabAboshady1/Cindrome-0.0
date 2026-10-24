const watchlistSection = document.querySelector(".watchlist-filter-section");

if (watchlistSection) {
  const searchInput = document.getElementById("watchlistSearchInput");
  const typePills = watchlistSection.querySelectorAll(".type-pill");
  const resetBtn = document.getElementById("watchlistResetBtn");
  const cards = document.querySelectorAll(".mini-content-card");
  const gridCountText = document.querySelector(".grid-count-text");

  function filterCards() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const activeTypeElement =
      watchlistSection.querySelector(".type-pill.active");
    const activeType = activeTypeElement
      ? activeTypeElement.getAttribute("data-type")
      : "all";
    let visibleCount = 0;

    cards.forEach((card) => {
      const cardTitle = (card.getAttribute("data-tooltip") || "").toLowerCase();
      const cardType = card.getAttribute("data-type") || "";

      const matchesSearch = cardTitle.includes(searchTerm);
      const matchesType = activeType === "all" || activeType === cardType;

      if (matchesSearch && matchesType) {
        card.style.display = "block";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });

    if (gridCountText) {
      gridCountText.textContent = `${visibleCount} Titles`;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterCards);
  }

  typePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      typePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      filterCards();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      searchInput.value = "";
      typePills.forEach((p) => p.classList.remove("active"));
      watchlistSection
        .querySelector('.type-pill[data-type="all"]')
        .classList.add("active");
      filterCards();
    });
  }
}

// =====================================================================
// 🌟 نظام إظهار الأزرار عند اللمس (للموبايل فقط) - بدون تعارض مع الفلتر 🌟
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
  // بنعمل Query جديدة للكروت عشان نضمن إنها تشتغل حتى لو قسم الفلتر مش موجود لسبب ما
  const allCards = document.querySelectorAll(".mini-content-card");

  // بنشغل الكود ده بس لو عرض الشاشة الموبايل أو التابلت
  if (window.innerWidth <= 768 && allCards.length > 0) {
    allCards.forEach((card) => {
      card.addEventListener("click", function (e) {
        // لو اليوزر داس على زرار من الزراير اللي جوه (زي الحذف أو اللايك)، سيبه ينفذ الأكشن بتاعه
        if (e.target.closest(".mini-bar-btn")) return;

        // بنشوف هل الكارت ده البار بتاعه ظاهر دلوقتي؟
        const isCurrentlyShowing = this.classList.contains("show-bar");

        // نخفي البار من كل الكروت التانية في الصفحة
        allCards.forEach((c) => c.classList.remove("show-bar"));

        // لو مكنش ظاهر، نظهره
        if (!isCurrentlyShowing) {
          this.classList.add("show-bar");
        }
      });
    });

    // لو اليوزر داس في أي مكان فاضي في الصفحة بره الكروت، نخفي كل البارات
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".mini-content-card")) {
        allCards.forEach((c) => c.classList.remove("show-bar"));
      }
    });
  }
});
