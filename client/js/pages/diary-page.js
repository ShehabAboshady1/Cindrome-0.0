document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 🌟 1. تفاعلات القوائم المنسدلة (Dropdown Filters)
  // ==========================================
  const dropdownItems = document.querySelectorAll(
    ".diary-filter-section .dropdown-item",
  );

  dropdownItems.forEach((item) => {
    item.addEventListener("click", function () {
      const details = this.closest("details");
      const summarySpan = details.querySelector(
        ".dropdown-selected span:first-child",
      );
      summarySpan.textContent = this.textContent;
      details.removeAttribute("open");
    });
  });

  document.addEventListener("click", (e) => {
    document
      .querySelectorAll(".diary-filter-section details")
      .forEach((details) => {
        if (!details.contains(e.target)) {
          details.removeAttribute("open");
        }
      });
  });

  // ==========================================
  // 🌟 2. تفاعل زرار الحذف (Custom Modal Delete)
  // ==========================================
  const deleteBtns = document.querySelectorAll(".delete-btn");
  const confirmModal = document.getElementById("deleteConfirmModal");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  let logToDelete = null; // متغير عشان نحفظ فيه بيانات الريفيو اللي هيتحذف

  // لما اليوزر يدوس على أي زرار حذف في القائمة
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      // نحفظ السطر والـ ID
      logToDelete = {
        row: this.closest(".diary-entry-row"),
        id: this.getAttribute("data-id"),
      };
      // نظهر المودال بتاعنا بدل الـ Alert القديم
      if (confirmModal) confirmModal.style.display = "flex";
    });
  });

  // لو داس Cancel نلغي العملية ونقفل المودال
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      logToDelete = null;
      if (confirmModal) confirmModal.style.display = "none";
    });
  }

  // لو أكد الحذف (داس Delete)
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!logToDelete) return;

      const { row, id } = logToDelete;

      // نعمل أنيميشن تحميل جوا الزرار
      const originalText = confirmDeleteBtn.innerHTML;
      confirmDeleteBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i>';
      confirmDeleteBtn.style.opacity = "0.7";
      confirmDeleteBtn.disabled = true;

      try {
        const response = await fetch(`/api/reviews/${id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          // إخفاء المودال فوراً بعد النجاح
          if (confirmModal) confirmModal.style.display = "none";

          // مسح العنصر من الشاشة بـ Fade-out
          row.classList.add("fade-out");
          setTimeout(() => row.remove(), 400);
        } else {
          alert("Failed to delete the log. Please try again.");
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        // نرجع كل حاجة لأصلها
        logToDelete = null;
        confirmDeleteBtn.innerHTML = originalText;
        confirmDeleteBtn.style.opacity = "1";
        confirmDeleteBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // 🌟 3. تفاعل زرار التعديل (Edit Pre-fill Logic)
  // ==========================================
  const editBtns = document.querySelectorAll(".edit-btn");
  const logModal = document.getElementById("logModal");
  const modalTitle = logModal
    ? logModal.querySelector(".modal-main-title")
    : null;
  const reviewText = document.getElementById("reviewText");
  const likeToggle = document.getElementById("likeToggle");
  const rewatchToggle = document.getElementById("rewatchToggle");
  const spoilerToggle = document.getElementById("spoilerToggle");
  const stars = document.querySelectorAll("#logModal .rate-star");

  const logGlobalSearch = logModal
    ? logModal.querySelector(".log-global-search")
    : null;
  const logItemHeader = logModal
    ? logModal.querySelector(".log-item-header")
    : null;
  const modalPoster = logModal
    ? logModal.querySelector(".log-item-poster")
    : null;
  const modalItemTitle = logModal
    ? logModal.querySelector(".log-item-title")
    : null;
  const modalTypeBadge = logModal
    ? logModal.querySelector(".type-badge")
    : null;
  const seasonSelectors = logModal
    ? logModal.querySelector(".season-episode-selectors")
    : null;

  function updateModalStars(value) {
    stars.forEach((star, index) => {
      star.className = "rate-star fa-star";
      if (value >= index + 1) {
        star.classList.add("fa-solid");
      } else if (value === index + 0.5) {
        star.classList.add("fa-solid", "fa-star-half-stroke");
      } else {
        star.classList.add("fa-regular");
      }
    });
  }

  editBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const rating = parseFloat(this.getAttribute("data-rating")) || 0;
      const isLiked = this.getAttribute("data-liked") === "true";
      const isRewatched = this.getAttribute("data-rewatched") === "true";
      const isSpoiler = this.getAttribute("data-spoiler") === "true";
      const review = this.getAttribute("data-review") || "";

      const itemTitle = this.getAttribute("data-title");
      const itemSeason = this.getAttribute("data-season");
      const itemEpisode = this.getAttribute("data-episode");
      const itemType = this.getAttribute("data-type");
      const itemPoster = this.getAttribute("data-poster");
      const reviewId = this.getAttribute("data-reviewid");
      const tmdbId = this.getAttribute("data-tmdbid");
      const logReviewIdInput = document.getElementById("logReviewId");
      if (logReviewIdInput) logReviewIdInput.value = reviewId;
      const idInput = document.getElementById("logMediaId");
      const typeInput = document.getElementById("logMediaType");
      const rawDate = this.getAttribute("data-date");
      const dateInput = document.getElementById("watchDate");

      if (dateInput) {
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            dateInput.value = `${year}-${month}-${day}`;
          }
        } else {
          dateInput.value = new Date().toISOString().split("T")[0];
        }
      }
      if (idInput) idInput.value = tmdbId;
      if (typeInput) typeInput.value = itemType.toLowerCase();

      if (logGlobalSearch) logGlobalSearch.style.display = "none";
      if (logItemHeader) logItemHeader.style.display = "flex";

      if (modalTitle) modalTitle.textContent = "Edit Log";
      if (modalPoster && itemPoster) modalPoster.src = itemPoster;
      if (modalItemTitle && itemTitle) modalItemTitle.textContent = itemTitle;
      if (modalTypeBadge && itemType) modalTypeBadge.textContent = itemType;

      const seasonText = document.getElementById("seasonText");
      const episodeText = document.getElementById("episodeText");

      if (seasonText) {
        seasonText.textContent = itemSeason
          ? `Season ${itemSeason}`
          : "All Seasons";
      }
      if (episodeText) {
        episodeText.textContent = itemEpisode
          ? `Episode ${itemEpisode}`
          : "All Episodes";
      }

      if (seasonSelectors) {
        if (itemType.toUpperCase() === "MOVIE") {
          seasonSelectors.style.display = "none";
        } else {
          seasonSelectors.style.display = "flex";

          // 🌟 الجديد: نكلم TMDB ونبني قائمة المواسم والحلقات زي ما السيرش بيعمل بالظبط 🌟
          // 🌟 نكلم TMDB ونبني قائمة المواسم والحلقات 🌟
          if (tmdbId) {
            fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=ea76631510d3901482064d17498c07b5`,
            )
              .then((res) => res.json())
              .then(async (data) => {
                // 🌟 ضفنا async هنا 🌟
                const totalSeasons = data.number_of_seasons || 1;
                const seasonList = document.getElementById("logSeasonList");

                // تفريغ وبناء المواسم
                if (seasonList) {
                  seasonList.innerHTML =
                    '<li class="dropdown-item" onclick="selectDropdownOption(this, \'seasonText\')">All Seasons</li>';
                  for (let s = 1; s <= totalSeasons; s++) {
                    const li = document.createElement("li");
                    li.className = "dropdown-item";
                    li.textContent = `Season ${s}`;
                    li.onclick = function () {
                      window.selectDropdownOption(this, "seasonText");
                    };
                    seasonList.appendChild(li);
                  }
                }

                // 🌟 نستنى بناء الحلقات يخلص، وبعدين نرجع رقم الحلقة اللي اليوزر مسجله 🌟
                if (window.updateLogModalEpisodes) {
                  await window.updateLogModalEpisodes(
                    itemSeason ? parseInt(itemSeason) : 1,
                  );

                  // إجبار المودال إنه يكتب رقم الحلقة الصح بعد ما الـ Reset يخلص
                  if (episodeText) {
                    episodeText.textContent = itemEpisode
                      ? `Episode ${itemEpisode}`
                      : "All Episodes";
                  }
                }
              })
              .catch((err) => console.error("Error fetching seasons:", err));
          }
        }
      }

      if (reviewText) reviewText.value = review;
      updateModalStars(rating);

      // هنا بنقرأ الداتا القديمة ونعرضها (مش بنعمل كليك)
      if (isLiked) likeToggle.classList.add("active");
      else likeToggle.classList.remove("active");

      if (isRewatched) rewatchToggle.classList.add("active");
      else rewatchToggle.classList.remove("active");

      if (isSpoiler) spoilerToggle.classList.add("spoiler-active");
      else spoilerToggle.classList.remove("spoiler-active");

      if (logModal) logModal.style.display = "flex";
    });
  });

  // ==========================================
  // 🌟 4. تصليحات التعارض مع modals.js 🌟
  // ==========================================
  // حذفنا كود الناف بار المكرر اللي كان بيعمل شلل للمودال، وضيفنا الحل ده:

  // 1. إظهار البوستر تلقائياً بعد اختيار نتيجة من البحث في الناف بار
  const logSearchResults = document.getElementById("logSearchResults");
  if (logSearchResults) {
    logSearchResults.addEventListener("click", () => {
      if (logItemHeader) logItemHeader.style.display = "flex";
      if (logGlobalSearch) logGlobalSearch.style.display = "none";
    });
  }

  // 2. إجبار زراير المودال إنها تنور وتطفي لو الكود اللي بره معرفش يوصلها
  if (likeToggle && !likeToggle.dataset.diaryBound) {
    likeToggle.dataset.diaryBound = "true";
    likeToggle.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("active");
    });
  }
  if (rewatchToggle && !rewatchToggle.dataset.diaryBound) {
    rewatchToggle.dataset.diaryBound = "true";
    rewatchToggle.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("active");
    });
  }
  if (spoilerToggle && !spoilerToggle.dataset.diaryBound) {
    spoilerToggle.dataset.diaryBound = "true";
    spoilerToggle.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("spoiler-active");
    });
  }
});
