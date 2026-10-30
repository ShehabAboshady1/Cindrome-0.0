document.addEventListener("DOMContentLoaded", () => {
  // Search modal controls
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

  // Log modal controls
  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal");
  const navLogBtn = document.getElementById("navLogBtn");
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

  // Close modals on backdrop click
  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
  });

  // Log modal internal inputs and controls
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

  // Star rating handler
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

  // Close dropdown menus when clicking outside
  document.addEventListener("click", function (event) {
    const dropdowns = document.querySelectorAll(".css-dropdown");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.removeAttribute("open");
      }
    });
  });
});

// Global watchlist toggle handler
async function toggleWatchlist(buttonElement, tmdbId, mediaType) {
  const isHeroBtn = buttonElement.classList.contains("hero-watchlist-btn");
  const originalHTML = buttonElement.innerHTML;

  if (isHeroBtn) {
    buttonElement.innerHTML = `<span class="default-content"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`;
  } else {
    buttonElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  }
  buttonElement.disabled = true;

  try {
    const response = await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    await response.json();

    if (response.status === 200) {
      buttonElement.classList.toggle("added");

      if (buttonElement.classList.contains("mini-bar-btn")) {
        const isAdded = buttonElement.classList.contains("added");
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
    buttonElement.disabled = false;
  }
}

// Global media like toggle handler
async function toggleLike(buttonElement, tmdbId, mediaType) {
  const originalHTML = buttonElement.innerHTML;

  buttonElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  buttonElement.disabled = true;

  try {
    const response = await fetch("/api/like/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    await response.json();

    if (response.status === 200) {
      buttonElement.classList.toggle("liked");

      if (buttonElement.classList.contains("btn-fav")) {
        buttonElement.classList.toggle("is-favorited");
        buttonElement.innerHTML = originalHTML;
      } else {
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
