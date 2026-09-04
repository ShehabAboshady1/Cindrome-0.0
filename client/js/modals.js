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
      if (summaryText) summaryText.textContent = this.textContent;
      details.removeAttribute("open");
    });
  });

  // د- تشغيل القوائم المنسدلة العادية جوه نافذة الـ Log (المواسم والحلقات)
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
      details.removeAttribute("open");
    });
  });

  // ==========================================
  // 🌟 2. تفاعلات نافذة الـ Log الداخلي 🌟
  // ==========================================
  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal");
  const navLogBtn = document.getElementById("navLogBtn");
  const closeLogBtn = document.getElementById("closeLogModalBtn");
  const cancelLogBtn = document.getElementById("cancelLogBtn");

  const dateInput = document.getElementById("watchDate");
  const reviewText = document.getElementById("reviewText");
  const toggleBtns = document.querySelectorAll("#logModal .icon-toggle-btn");
  const stars = document.querySelectorAll("#logModal .rate-star");
  let currentRating = 0;

  window.resetLogData = function () {
    currentRating = 0;
    stars.forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    toggleBtns.forEach((btn) => btn.classList.remove("active", "spoiler-active"));

    if (reviewText) reviewText.value = "";
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const searchInput = document.querySelector("#logModal .log-global-search input");
    if (searchInput) searchInput.value = "";
  };

  function openLog() {
    if (logModal) logModal.style.display = "flex";
  }

  if (openLogBtn) {
    openLogBtn.addEventListener("click", () => {
      window.resetLogData();
      openLog();
    });
  }

  if (navLogBtn) {
    navLogBtn.addEventListener("click", () => {
      window.resetLogData();
      const logGlobalSearch = document.querySelector("#logModal .log-global-search");
      if (logGlobalSearch) {
        logGlobalSearch.style.display = "flex";
      }
      openLog();
    });
  }

  function closeLog() {
    if (logModal) logModal.style.display = "none";
  }

  if (closeLogBtn) closeLogBtn.addEventListener("click", closeLog);
  if (cancelLogBtn) cancelLogBtn.addEventListener("click", closeLog);

  // ==========================================
  // 🌟 3. لوجيك النجوم والأيقونات جوه نافذة الـ Log 🌟
  // ==========================================
  const regularToggles = document.querySelectorAll("#logModal .icon-toggle-btn:not(.spoiler-btn)");
  regularToggles.forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  const spoilerBtn = document.querySelector("#logModal .spoiler-btn");
  if (spoilerBtn) {
    spoilerBtn.addEventListener("click", () =>
      spoilerBtn.classList.toggle("spoiler-active"),
    );
  }

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

  // ==========================================
  // 🌟 4. تفاعلات نافذة إنشاء القائمة (Create List Modal) 🌟
  // ==========================================
  const createListModal = document.getElementById("createListModal");
  const openCreateListBtn = document.getElementById("openCreateListBtn");
  const closeCreateListBtn = document.getElementById("closeCreateListBtn");
  const cancelListBtn = document.getElementById("cancelListBtn");
  const addedItemsContainer = document.getElementById("addedItemsContainer");
  const addMovieSearch = document.getElementById("addMovieSearch");

  function openCreateModal() {
    if (createListModal) createListModal.style.display = "flex";
  }

  function closeCreateModal() {
    if (createListModal) createListModal.style.display = "none";
  }

  if (openCreateListBtn) openCreateListBtn.addEventListener("click", openCreateModal);
  if (closeCreateListBtn) closeCreateListBtn.addEventListener("click", closeCreateModal);
  if (cancelListBtn) cancelListBtn.addEventListener("click", closeCreateModal);

  // سحب وإفلات العناصر داخل القائمة
  let draggedItem = null;

  function handleDragStart() {
    draggedItem = this;
    setTimeout(() => this.classList.add("dragging"), 0);
  }

  function handleDragEnd() {
    this.classList.remove("dragging");
    draggedItem = null;
    document.querySelectorAll(".modal-mini-card").forEach((c) => c.classList.remove("drag-over"));
  }

  function handleDragOver(e) {
    e.preventDefault();
    this.classList.add("drag-over");
  }

  function handleDragLeave() {
    this.classList.remove("drag-over");
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove("drag-over");
    if (draggedItem && draggedItem !== this && addedItemsContainer) {
      const allItems = [...addedItemsContainer.querySelectorAll(".modal-mini-card")];
      const draggedIdx = allItems.indexOf(draggedItem);
      const droppedIdx = allItems.indexOf(this);

      if (draggedIdx < droppedIdx) {
        this.after(draggedItem);
      } else {
        this.before(draggedItem);
      }
    }
  }

  function attachDragEvents(item) {
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragend", handleDragEnd);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("dragleave", handleDragLeave);
    item.addEventListener("drop", handleDrop);
  }

  document.querySelectorAll(".modal-mini-card").forEach(attachDragEvents);

  // حذف كارت من القائمة المنبثقة
  if (addedItemsContainer) {
    addedItemsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-mini-btn");
      if (btn) {
        const card = btn.closest(".mini-content-card");
        if (card) {
          card.style.transform = "scale(0)";
          card.style.opacity = "0";
          setTimeout(() => card.remove(), 200);
        }
      }
    });
  }

  // إضافة كارت جديد من مربع بحث القائمة
  if (addMovieSearch && addedItemsContainer) {
    addMovieSearch.addEventListener("keypress", function (e) {
      if (e.key === "Enter" && this.value.trim() !== "") {
        e.preventDefault();

        const newCard = document.createElement("div");
        newCard.className = "mini-content-card modal-mini-card";
        newCard.draggable = true;
        newCard.innerHTML = `
            <div class="mini-card-media">
                <img src="https://image.tmdb.org/t/p/w200/8bZCaPAPPil3ea2c9xSsmfsibGB.jpg" class="mini-card-poster" alt="New Item">
            </div>
            <button type="button" class="remove-mini-btn" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        `;

        addedItemsContainer.prepend(newCard);
        attachDragEvents(newCard);
        this.value = "";
      }
    });
  }

  // ==========================================
  // 🌟 5. إغلاق النوافذ والقوائم عند النقر بالخارج 🌟
  // ==========================================
  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
    if (e.target === createListModal) closeCreateModal();
  });

  document.addEventListener("click", function (event) {
    const dropdowns = document.querySelectorAll(".css-dropdown, .g-css-dropdown");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.removeAttribute("open");
      }
    });
  });
});