document.addEventListener("DOMContentLoaded", () => {
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

  const gTypePills = document.querySelectorAll(".g-type-pill");
  gTypePills.forEach((pill) => {
    pill.addEventListener("click", function () {
      gTypePills.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");
    });
  });

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

  window.selectDropdownOption = function (el, targetId) {
    const target = document.getElementById(targetId);
    if (target) {
      target.textContent = el.textContent.trim();
    }
    const details = el.closest("details");
    if (details) {
      details.removeAttribute("open");
    }

    if (targetId === "seasonText") {
      const match = el.textContent.match(/\d+/);
      if (match) {
        const seasonNumber = parseInt(match[0], 10);
        window.updateLogModalEpisodes(seasonNumber);
      }
    }
  };

  window.updateLogModalEpisodes = async function (seasonNumber) {
    const mediaIdInput = document.getElementById("logMediaId");
    const epList = document.getElementById("logEpisodeList");
    const epText = document.getElementById("episodeText");

    if (!mediaIdInput || !mediaIdInput.value || !epList) return;

    const mediaId = mediaIdInput.value;
    if (epText) epText.textContent = "All Episodes";

    epList.innerHTML =
      '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li><li class="dropdown-item" style="opacity: 0.5;">Loading...</li>';

    try {
      const response = await fetch(`/api/tv/${mediaId}/season/${seasonNumber}`);
      const episodes = await response.json();

      epList.innerHTML =
        '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li>';

      if (Array.isArray(episodes) && episodes.length > 0) {
        episodes.forEach((ep) => {
          const li = document.createElement("li");
          li.className = "dropdown-item";
          li.textContent = "Episode " + ep.episode_number;
          li.onclick = function () {
            window.selectDropdownOption(this, "episodeText");
          };
          epList.appendChild(li);
        });
      }
    } catch (error) {
      epList.innerHTML =
        '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li>';
    }
  };

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
  const logSearchInput = document.getElementById("logSearchInput");
  const logSearchResults = document.getElementById("logSearchResults");
  let searchDebounceTimer = null;

  if (logSearchInput && logSearchResults) {
    logSearchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      clearTimeout(searchDebounceTimer);

      if (query.length < 2) {
        logSearchResults.innerHTML = "";
        logSearchResults.style.display = "none";
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const items = await res.json();

          if (!Array.isArray(items) || items.length === 0) {
            logSearchResults.innerHTML =
              '<div style="padding: 12px; color: #94a3b8; font-size: 13px; text-align: center;">No results found</div>';
            logSearchResults.style.display = "block";
            return;
          }

          logSearchResults.innerHTML = "";
          items.forEach((item) => {
            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
              <img src="${item.poster}" class="search-result-thumb">
              <div class="search-result-info">
                <span class="search-result-title">${item.title}</span>
                <span class="search-result-meta">${item.badge} • ${item.year || "N/A"}</span>
              </div>
            `;

            div.onclick = () => selectMediaFromSearch(item);
            logSearchResults.appendChild(div);
          });

          logSearchResults.style.display = "block";
        } catch (err) {
          logSearchResults.style.display = "none";
        }
      }, 300);
    });
  }

  async function selectMediaFromSearch(item) {
    logSearchResults.style.display = "none";
    logSearchInput.value = "";

    const idInput = document.getElementById("logMediaId");
    const typeInput = document.getElementById("logMediaType");
    const poster = document.getElementById("logItemPoster");
    const title = document.getElementById("logItemTitle");
    const badge = document.getElementById("logItemBadge");
    const selectors = document.getElementById("logSeasonEpSelectors");
    const seasonList = document.getElementById("logSeasonList");
    const epList = document.getElementById("logEpisodeList");
    const seasonText = document.getElementById("seasonText");
    const epText = document.getElementById("episodeText");

    if (idInput) idInput.value = item.id;
    if (typeInput) typeInput.value = item.mediaType;
    if (poster) poster.src = item.poster;
    if (title) title.textContent = item.title;
    if (badge) badge.textContent = item.badge.toUpperCase();

    const isMovie = item.mediaType === "movie";

    if (selectors) {
      if (isMovie) {
        selectors.classList.add("is-hidden");
      } else {
        selectors.classList.remove("is-hidden");
      }
    }

    if (!isMovie) {
      if (seasonText) seasonText.textContent = "Season 1";
      if (epText) epText.textContent = "All Episodes";

      try {
        const detailRes = await fetch(
          `https://api.themoviedb.org/3/tv/${item.id}?api_key=ea76631510d3901482064d17498c07b5`,
        );
        const detailData = await detailRes.json();
        const totalSeasons = detailData.number_of_seasons || 1;

        if (seasonList) {
          seasonList.innerHTML = "";
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

        window.updateLogModalEpisodes(1);
      } catch (e) {}
    }
  }

  window.resetLogData = function () {
    currentRating = 0;
    stars.forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    toggleBtns.forEach((btn) =>
      btn.classList.remove("active", "spoiler-active"),
    );

    if (reviewText) reviewText.value = "";
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const searchInput = document.querySelector(
      "#logModal .log-global-search input",
    );
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
      const logGlobalSearch = document.querySelector(
        "#logModal .log-global-search",
      );
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

  const regularToggles = document.querySelectorAll(
    "#logModal .icon-toggle-btn:not(.spoiler-btn)",
  );
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

  if (openCreateListBtn)
    openCreateListBtn.addEventListener("click", openCreateModal);
  if (closeCreateListBtn)
    closeCreateListBtn.addEventListener("click", closeCreateModal);
  if (cancelListBtn) cancelListBtn.addEventListener("click", closeCreateModal);

  let draggedItem = null;

  function handleDragStart() {
    draggedItem = this;
    setTimeout(() => this.classList.add("dragging"), 0);
  }

  function handleDragEnd() {
    this.classList.remove("dragging");
    draggedItem = null;
    document
      .querySelectorAll(".modal-mini-card")
      .forEach((c) => c.classList.remove("drag-over"));
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
      const allItems = [
        ...addedItemsContainer.querySelectorAll(".modal-mini-card"),
      ];
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

  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
    if (e.target === createListModal) closeCreateModal();
  });

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

  let rawSearchResults = [];
  let activeFilters = {
    type: "all",
    genre: "all",
    rating: 0,
    sort: "default",
    year: "all",
  };

  const filterSearchInput = document.getElementById("filterSearchInput");
  const globalSearchResults = document.getElementById("globalSearchResults");
  const globalSearchStatus = document.getElementById("globalSearchStatus");
  const cardTemplate = document.getElementById("globalCardTemplate");
  const globalTypePills = document.querySelectorAll(
    ".g-type-selector .g-type-pill",
  );
  const globalResetBtn = document.getElementById("globalResetBtn");
  let globalSearchTimer = null;

  if (globalTypePills) {
    globalTypePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        globalTypePills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeFilters.type = pill.getAttribute("data-type") || "all";
        if (filterSearchInput && filterSearchInput.value.trim().length >= 2) {
          fetchGlobalSearch(filterSearchInput.value.trim());
        }
      });
    });
  }

  function setupDropdownFilter(dropdownId, textId, filterKey) {
    const dropdown = document.getElementById(dropdownId);
    const textSpan = document.getElementById(textId);
    if (!dropdown || !textSpan) return;

    dropdown.querySelectorAll(".g-dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const val = item.getAttribute("data-value");
        textSpan.textContent = item.textContent.trim();
        dropdown.removeAttribute("open");
        activeFilters[filterKey] = val;
        renderFilteredResults();
      });
    });
  }

  setupDropdownFilter("filterGenreDropdown", "genreFilterText", "genre");
  setupDropdownFilter("filterRatingDropdown", "ratingFilterText", "rating");
  setupDropdownFilter("filterSortDropdown", "sortFilterText", "sort");
  setupDropdownFilter("filterYearDropdown", "yearFilterText", "year");

  if (globalResetBtn) {
    globalResetBtn.addEventListener("click", () => {
      activeFilters = {
        type: "all",
        genre: "all",
        rating: 0,
        sort: "default",
        year: "all",
      };

      if (filterSearchInput) {
        filterSearchInput.value = "";
      }

      rawSearchResults = [];

      if (globalSearchResults) {
        globalSearchResults.innerHTML = "";
      }

      if (globalSearchStatus) {
        globalSearchStatus.style.display = "block";
        globalSearchStatus.textContent =
          "Type to search movies, series, or anime...";
      }

      if (globalTypePills) {
        globalTypePills.forEach((p) => p.classList.remove("active"));
        if (globalTypePills[0]) globalTypePills[0].classList.add("active");
      }

      const genreText = document.getElementById("genreFilterText");
      const ratingText = document.getElementById("ratingFilterText");
      const sortText = document.getElementById("sortFilterText");
      const yearText = document.getElementById("yearFilterText");

      if (genreText) genreText.textContent = "Genre";
      if (ratingText) ratingText.textContent = "Rating";
      if (sortText) sortText.textContent = "Sort By";
      if (yearText) yearText.textContent = "Year";
    });
  }

  if (filterSearchInput && globalSearchResults) {
    filterSearchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      clearTimeout(globalSearchTimer);

      if (val.length < 2) {
        rawSearchResults = [];
        globalSearchResults.innerHTML = "";
        if (globalSearchStatus) {
          globalSearchStatus.style.display = "block";
          globalSearchStatus.textContent =
            "Type to search movies, series, or anime...";
        }
        return;
      }

      globalSearchTimer = setTimeout(() => {
        fetchGlobalSearch(val);
      }, 350);
    });
  }

  async function fetchGlobalSearch(query) {
    if (globalSearchStatus) {
      globalSearchStatus.style.display = "block";
      globalSearchStatus.textContent = "Searching...";
    }
    globalSearchResults.innerHTML = "";

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${activeFilters.type}`,
      );
      rawSearchResults = await res.json();
      renderFilteredResults();
    } catch (err) {
      if (globalSearchStatus) {
        globalSearchStatus.style.display = "block";
        globalSearchStatus.textContent =
          "An error occurred while fetching results.";
      }
    }
  }

  function renderFilteredResults() {
    if (!globalSearchResults) return;
    globalSearchResults.innerHTML = "";

    if (!Array.isArray(rawSearchResults) || rawSearchResults.length === 0) {
      if (globalSearchStatus) {
        globalSearchStatus.style.display = "block";
        globalSearchStatus.textContent =
          "No titles found matching your search.";
      }
      return;
    }

    const genreMap = {
      action: [28, 10759],
      scifi: [878, 10765],
      drama: [18],
      mystery: [9648],
      fantasy: [14, 10765],
      comedy: [35],
      animation: [16],
    };

    let list = rawSearchResults.filter((item) => {
      if (activeFilters.genre !== "all") {
        const targetIds = genreMap[activeFilters.genre] || [];
        const hasGenre = item.genres.some((id) => targetIds.includes(id));
        if (!hasGenre) return false;
      }

      const minRating = parseFloat(activeFilters.rating);
      if (minRating > 0 && item.numericScore < minRating) {
        return false;
      }

      if (activeFilters.year !== "all") {
        const y = item.numericYear;
        if (!y) return false;
        if (activeFilters.year === "2010s" && (y < 2010 || y > 2019))
          return false;
        if (activeFilters.year === "2000s" && (y < 2000 || y > 2009))
          return false;
        if (activeFilters.year === "90s" && (y < 1990 || y > 1999))
          return false;
        if (activeFilters.year === "classics" && y >= 1990) return false;
        if (
          !isNaN(activeFilters.year) &&
          y !== parseInt(activeFilters.year, 10)
        )
          return false;
      }

      return true;
    });

    if (activeFilters.sort === "newest") {
      list.sort((a, b) => (b.numericYear || 0) - (a.numericYear || 0));
    } else if (activeFilters.sort === "oldest") {
      list.sort((a, b) => (a.numericYear || 0) - (b.numericYear || 0));
    } else if (activeFilters.sort === "rating") {
      list.sort((a, b) => b.numericScore - a.numericScore);
    }

    if (list.length === 0) {
      if (globalSearchStatus) {
        globalSearchStatus.style.display = "block";
        globalSearchStatus.textContent =
          "No results match the selected filters.";
      }
      return;
    }

    if (globalSearchStatus) {
      globalSearchStatus.style.display = "none";
    }

    list.forEach((item) => {
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
      meta.textContent = `${item.year} • ${item.badge}`;
      detailsLink.href = `/details?id=${item.id}&type=${item.mediaType}`;

      globalSearchResults.appendChild(clone);
    });
  }
});
