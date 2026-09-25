document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 🌟 1. تفاعلات ولوجيك زرار الـ Log 🌟
  // ==========================================
  const openLogBtn = document.getElementById("openLogModal");

  function resetLocalLogState() {
    const stars = document.querySelectorAll("#logModal .rate-star");
    stars.forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    const toggleBtns = document.querySelectorAll("#logModal .icon-toggle-btn");
    toggleBtns.forEach((btn) =>
      btn.classList.remove("active", "spoiler-active"),
    );

    const reviewText = document.getElementById("reviewText");
    if (reviewText) reviewText.value = "";

    const defaultTexts = ["Season 1", "All Episodes"];
    document
      .querySelectorAll("#logModal .dropdown-selected span:first-child")
      .forEach((span, index) => {
        if (defaultTexts[index]) span.textContent = defaultTexts[index];
      });
  }

  if (openLogBtn) {
    openLogBtn.addEventListener("click", () => {
      resetLocalLogState();

      const logGlobalSearch = document.querySelector(
        "#logModal .log-global-search",
      );
      const logItemHeader = document.querySelector(
        "#logModal .log-item-header",
      );

      if (logGlobalSearch) logGlobalSearch.style.display = "none";
      if (logItemHeader) logItemHeader.style.display = "flex";
    });
  }

  // ==========================================
  // 🌟 2. تفاعل زرار الـ Watchlist في الهيرو 🌟
  // ==========================================
  const heroWatchlistBtn = document.querySelector(
    ".action-buttons .watchlist-btn",
  );
  if (heroWatchlistBtn) {
    heroWatchlistBtn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("added");
      const icon = this.querySelector("i");

      if (icon) {
        if (this.classList.contains("added")) {
          icon.classList.replace("fa-regular", "fa-solid");
        } else {
          icon.classList.replace("fa-solid", "fa-regular");
        }
      }
    });
  }

  // ==========================================
  // 🌟 3. تفاعل زرار الـ Like في الهيرو 🌟
  // ==========================================
  const likeHeroBtn = document.querySelector(".like-btn-hero");
  if (likeHeroBtn) {
    likeHeroBtn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("liked");
      const icon = this.querySelector("i");
      if (icon) {
        if (this.classList.contains("liked")) {
          icon.classList.replace("fa-regular", "fa-solid");
        } else {
          icon.classList.replace("fa-solid", "fa-regular");
        }
      }
    });
  }

  // ==========================================
  // 🌟 4. تشغيل زرار الـ Like في المراجعات 🌟
  // ==========================================
  const reviewLikeBtns = document.querySelectorAll(".review-like-btn");
  reviewLikeBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("is-liked");
      const icon = this.querySelector("i");
      if (icon) {
        if (this.classList.contains("is-liked")) {
          icon.classList.replace("fa-regular", "fa-solid");
        } else {
          icon.classList.replace("fa-solid", "fa-regular");
        }
      }
    });
  });

  // ==========================================
  // 🌟 5. تبديل المواسم وجلب الحلقات ديناميكياً (المُعدل) 🌟
  // ==========================================
  const seasonsSection = document.getElementById("sec-episodes");
  if (seasonsSection) {
    const tvId = seasonsSection.getAttribute("data-tv-id");
    const seasonBtns = seasonsSection.querySelectorAll(".season-btn");
    const episodesContainer = document.getElementById("episodesListContainer");

    seasonBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        // تفعيل الزر المختار وإلغاء تفعيل البقية
        seasonBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const seasonNum = btn.getAttribute("data-season");
        if (!episodesContainer || !tvId) return;

        // إشعار تحميل سريع ومريح
        episodesContainer.innerHTML =
          '<p style="color: var(--accent-teal, #00b4d8); padding: 12px; font-size: 0.9rem;">Loading episodes...</p>';

        try {
          const response = await fetch(`/api/tv/${tvId}/season/${seasonNum}`);
          const episodes = await response.json();

          if (!episodes || episodes.length === 0) {
            episodesContainer.innerHTML =
              '<p style="color: #718096; padding: 12px; font-size: 0.9rem;">No episodes available for this season.</p>';
            return;
          }

          // رسم الحلقات الجديدة مباشرة داخل نفس الحاوية
          episodesContainer.innerHTML = episodes
            .map((ep) => {
              const epNum =
                ep.episode_number < 10
                  ? "0" + ep.episode_number
                  : ep.episode_number;
              const epTime = ep.runtime ? `${ep.runtime} min` : "45 min";
              return `
                            <a href="javascript:void(0)" class="ep-row ep-link">
                                <span class="ep-num">E${epNum}</span>
                                <div class="ep-info-flex">
                                    <span class="ep-title">${ep.name}</span>
                                    <span class="ep-time">${epTime}</span>
                                </div>
                            </a>
                        `;
            })
            .join("");
        } catch (err) {
          console.error("Failed to load season episodes:", err);
          episodesContainer.innerHTML =
            '<p style="color: #ff4757; padding: 12px; font-size: 0.9rem;">Failed to load episodes. Please try again.</p>';
        }
      });
    });
  }

  // ==========================================
  // 🌟 6. كشف الحرق (Spoilers) 🌟
  // ==========================================
  const blurredReviews = document.querySelectorAll(".review-body.blurred");
  blurredReviews.forEach((review) => {
    review.addEventListener("click", function () {
      if (this.classList.contains("blurred")) {
        this.classList.replace("blurred", "revealed");
        const fullText = this.getAttribute("data-full-text");
        if (fullText) this.innerText = fullText;
      }
    });
  });

  // ==========================================
  // 🌟 7. أزرار الكاروسيل للـ Reviews 🌟
  // ==========================================
  const reviewsRow = document.getElementById("reviewsRow");
  const reviewPrevBtn = document.getElementById("reviewPrev");
  const reviewNextBtn = document.getElementById("reviewNext");
  if (reviewsRow && reviewPrevBtn && reviewNextBtn) {
    reviewPrevBtn.addEventListener("click", () => {
      const card = reviewsRow.querySelector(".minimal-review-card");
      const step = card ? card.offsetWidth + 16 : 300;
      reviewsRow.scrollBy({ left: -step, behavior: "smooth" });
    });
    reviewNextBtn.addEventListener("click", () => {
      const card = reviewsRow.querySelector(".minimal-review-card");
      const step = card ? card.offsetWidth + 16 : 300;
      reviewsRow.scrollBy({ left: step, behavior: "smooth" });
    });
  }
});
