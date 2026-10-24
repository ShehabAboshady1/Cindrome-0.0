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
