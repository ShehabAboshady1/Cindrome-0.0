const watchlistSection = document.querySelector(".watchlist-filter-section");

if (watchlistSection) {
  const searchInput = document.getElementById("watchlistSearchInput");
  const typePills = watchlistSection.querySelectorAll(".type-pill");
  const resetBtn = document.getElementById("watchlistResetBtn");
  const cards = document.querySelectorAll(".mini-content-card");
  const gridCountText = document.querySelector(".grid-count-text");

  // Filter watchlist items by query and media type
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

// Mobile touch interaction: reveal action bar
document.addEventListener("DOMContentLoaded", () => {
  const allCards = document.querySelectorAll(".mini-content-card");

  if (window.innerWidth <= 768 && allCards.length > 0) {
    allCards.forEach((card) => {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".mini-bar-btn")) return;

        const isCurrentlyShowing = this.classList.contains("show-bar");

        allCards.forEach((c) => c.classList.remove("show-bar"));

        if (!isCurrentlyShowing) {
          this.classList.add("show-bar");
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".mini-content-card")) {
        allCards.forEach((c) => c.classList.remove("show-bar"));
      }
    });
  }
});
