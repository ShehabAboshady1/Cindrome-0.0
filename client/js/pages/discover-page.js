document.addEventListener("DOMContentLoaded", () => {
  const state = {
    q: "",
    type: "all",
    genre: "all",
    rating: "0",
    sort: "popular",
    year: "all",
    page: 1,
    totalPages: 1,
  };

  const searchInput = document.getElementById("discoverSearchInput");
  const typePills = document.querySelectorAll(
    "#discoverTypeSelector .type-pill",
  );
  const resetBtn = document.getElementById("discoverResetBtn");
  const cardsGrid = document.getElementById("discoverCardsGrid");
  const statusMsg = document.getElementById("discoverStatusMsg");
  const paginationNav = document.getElementById("discoverPagination");
  const cardTemplate = document.getElementById("discoverCardTemplate");
  const gridTitle = document.getElementById("discoverGridTitle");

  let searchDebounceTimer = null;

  function setupDiscoverDropdown(dropdownId, textId, filterKey) {
    const dropdown = document.getElementById(dropdownId);
    const textSpan = document.getElementById(textId);
    if (!dropdown || !textSpan) return;

    dropdown.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const val = item.getAttribute("data-value");
        textSpan.textContent = item.textContent.trim();
        dropdown.removeAttribute("open");
        state[filterKey] = val;
        state.page = 1;
        fetchDiscoverData();
      });
    });
  }

  setupDiscoverDropdown("discoverGenreDropdown", "discoverGenreText", "genre");
  setupDiscoverDropdown(
    "discoverRatingDropdown",
    "discoverRatingText",
    "rating",
  );
  setupDiscoverDropdown("discoverSortDropdown", "discoverSortText", "sort");
  setupDiscoverDropdown("discoverYearDropdown", "discoverYearText", "year");

  if (typePills) {
    typePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        typePills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        state.type = pill.getAttribute("data-type") || "all";
        state.page = 1;

        if (gridTitle) {
          if (state.type === "movie") gridTitle.textContent = "Movies";
          else if (state.type === "tv") gridTitle.textContent = "Series";
          else if (state.type === "anime") gridTitle.textContent = "Anime";
          else gridTitle.textContent = "All Content";
        }

        fetchDiscoverData();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      state.q = e.target.value.trim();
      state.page = 1;

      searchDebounceTimer = setTimeout(() => {
        fetchDiscoverData();
      }, 400);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.q = "";
      state.type = "all";
      state.genre = "all";
      state.rating = "0";
      state.sort = "popular";
      state.year = "all";
      state.page = 1;

      if (searchInput) searchInput.value = "";

      if (typePills) {
        typePills.forEach((p) => p.classList.remove("active"));
        if (typePills[0]) typePills[0].classList.add("active");
      }

      const gText = document.getElementById("discoverGenreText");
      const rText = document.getElementById("discoverRatingText");
      const sText = document.getElementById("discoverSortText");
      const yText = document.getElementById("discoverYearText");

      if (gText) gText.textContent = "Genre";
      if (rText) rText.textContent = "Rating";
      if (sText) sText.textContent = "Sort By";
      if (yText) yText.textContent = "Year";
      if (gridTitle) gridTitle.textContent = "All Content";

      fetchDiscoverData();
    });
  }

  async function fetchDiscoverData() {
    if (!cardsGrid) return;

    cardsGrid.innerHTML = "";
    if (statusMsg) {
      statusMsg.style.display = "block";
      statusMsg.textContent = "Loading content...";
    }

    try {
      const params = new URLSearchParams({
        q: state.q,
        type: state.type,
        genre: state.genre,
        rating: state.rating,
        sort: state.sort,
        year: state.year,
        page: state.page,
      });

      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = await res.json();

      state.totalPages = data.totalPages || 1;
      renderCards(data.results || []);
      renderPagination();
    } catch (err) {
      if (statusMsg) {
        statusMsg.style.display = "block";
        statusMsg.textContent = "Failed to load content. Please try again.";
      }
    }
  }

  function renderCards(items) {
    cardsGrid.innerHTML = "";

    if (!items || items.length === 0) {
      if (statusMsg) {
        statusMsg.style.display = "block";
        statusMsg.textContent = "No content matches the selected filters.";
      }
      return;
    }

    if (statusMsg) {
      statusMsg.style.display = "none";
    }

    items.forEach((item) => {
      const clone = cardTemplate.content.cloneNode(true);
      const poster = clone.querySelector(".card-poster");
      const badge = clone.querySelector(".type-badge");
      const ratingScore = clone.querySelector(".rating-score");
      const title = clone.querySelector(".card-title");
      const meta = clone.querySelector(".meta-row");
      const detailsLink = clone.querySelector(".btn-details");

      poster.src = item.poster;
      poster.alt = item.title;
      badge.textContent = item.badge.toUpperCase();
      ratingScore.textContent = `★ ${item.score}`;
      title.textContent = item.title;
      title.title = item.title;
      meta.textContent = `${item.genres} • ${item.year}`;
      detailsLink.href = `/details?id=${item.id}&type=${item.mediaType}`;

      cardsGrid.appendChild(clone);
    });
  }

  function renderPagination() {
    if (!paginationNav) return;
    paginationNav.innerHTML = "";

    if (state.totalPages <= 1) return;

    // دالة مساعدة عشان تطلع الشاشة لفوق لشريط الفلاتر بسلاسة
    function scrollToFilters() {
      const filterSection = document.querySelector(".discover-filter-section");
      if (filterSection) {
        filterSection.scrollIntoView({ behavior: "smooth" });
      }
    }

    // زرار PREV
    const prevBtn = document.createElement("button");
    prevBtn.className = `page-btn prev-next ${state.page === 1 ? "disabled" : ""}`;
    prevBtn.type = "button";
    prevBtn.textContent = "PREV";
    if (state.page === 1) prevBtn.disabled = true;
    prevBtn.onclick = () => {
      if (state.page > 1) {
        state.page--;
        fetchDiscoverData();
        scrollToFilters();
      }
    };
    paginationNav.appendChild(prevBtn);

    // أرقام الصفحات
    const pages = getPaginationPages(state.page, state.totalPages);

    pages.forEach((p) => {
      if (p === "...") {
        const dots = document.createElement("span");
        dots.className = "pagination-dots";
        dots.textContent = "...";
        paginationNav.appendChild(dots);
      } else {
        const btn = document.createElement("button");
        btn.className = `page-btn ${p === state.page ? "active" : ""}`;
        btn.type = "button";
        btn.textContent = p;
        btn.onclick = () => {
          if (p !== state.page) {
            state.page = p;
            fetchDiscoverData();
            scrollToFilters();
          }
        };
        paginationNav.appendChild(btn);
      }
    });

    // زرار NEXT
    const nextBtn = document.createElement("button");
    nextBtn.className = `page-btn prev-next ${state.page === state.totalPages ? "disabled" : ""}`;
    nextBtn.type = "button";
    nextBtn.textContent = "NEXT";
    if (state.page === state.totalPages) nextBtn.disabled = true;
    nextBtn.onclick = () => {
      if (state.page < state.totalPages) {
        state.page++;
        fetchDiscoverData();
        scrollToFilters();
      }
    };
    paginationNav.appendChild(nextBtn);
  }

  function getPaginationPages(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", total];
    }

    if (current >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    }

    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  if (cardsGrid) {
    cardsGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-watchlist");
      if (btn) {
        e.preventDefault();
        btn.classList.toggle("added");
      }
    });
  }

  fetchDiscoverData();
});
