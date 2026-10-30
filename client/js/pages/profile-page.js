// Profile global navigation and view controls

window.setFollowState = function (state) {
  const followBtn = document.getElementById("followBtn");
  if (!followBtn) return;

  const icon = followBtn.querySelector("i");
  const label = followBtn.querySelector(".btn-label");

  followBtn.classList.remove("is-active", "is-requested");

  if (state === "requested") {
    followBtn.classList.add("is-requested");
    followBtn.setAttribute("aria-pressed", "true");
    followBtn.setAttribute("aria-label", "Follow request sent");
    if (icon) icon.className = "fa-solid fa-clock";
    if (label) label.textContent = "Requested";
  } else if (state === "following" || state === true) {
    followBtn.classList.add("is-active");
    followBtn.setAttribute("aria-pressed", "true");
    followBtn.setAttribute("aria-label", "Following user");
    if (icon) icon.className = "fa-solid fa-check";
    if (label) label.textContent = "Following";
  } else {
    followBtn.setAttribute("aria-pressed", "false");
    followBtn.setAttribute("aria-label", "Follow user");
    if (icon) icon.className = "fa-solid fa-user-plus";
    if (label) label.textContent = "Follow";
  }
};

window.switchProfileTab = function (tabId, btnElement) {
  document.querySelectorAll(".profile-tab-panel").forEach((panel) => {
    panel.style.display = "none";
  });

  const targetPanel = document.getElementById("panel-" + tabId);
  if (targetPanel) targetPanel.style.display = "block";

  document.querySelectorAll(".profile-tab-btn").forEach((btn) => {
    btn.classList.remove("is-active");
  });
  if (btnElement) btnElement.classList.add("is-active");

  const mainContainer = document.getElementById("mainContainer");
  const overviewSidebar = document.getElementById("overview-sidebar-content");
  const reviewsSidebar = document.getElementById("reviews-sidebar-content");

  if (tabId === "overview") {
    if (mainContainer) mainContainer.classList.remove("hide-sidebar");
    if (overviewSidebar) overviewSidebar.style.display = "block";
    if (reviewsSidebar) reviewsSidebar.style.display = "none";
  } else if (tabId === "reviews") {
    if (mainContainer) mainContainer.classList.remove("hide-sidebar");
    if (overviewSidebar) overviewSidebar.style.display = "none";
    if (reviewsSidebar) reviewsSidebar.style.display = "block";
  } else {
    if (mainContainer) mainContainer.classList.add("hide-sidebar");
  }
};

window.revealSpoiler = function (el) {
  el.classList.replace("blurred", "revealed");
};

window.scrollFavorites = function (direction) {
  const row = document.getElementById("favoritesRow");
  const card = row?.querySelector(".content-card");
  if (!row || !card) return;
  const step = card.offsetWidth + 14;
  row.scrollBy({ left: direction * step, behavior: "smooth" });
};

window.scrollLists = function (direction) {
  const row = document.getElementById("listsRow");
  const card = row?.querySelector(".list-card");
  if (!row || !card) return;
  const step = card.offsetWidth + 24;
  row.scrollBy({ left: direction * step, behavior: "smooth" });
};

window.setProfileMode = function (mode) {
  document.body.classList.remove("profile-page-self", "profile-page-other");
  document.body.classList.add(
    mode === "other" ? "profile-page-other" : "profile-page-self",
  );
};

window.setPrivacyMode = function (isPrivate) {
  document.body.classList.toggle("is-private", isPrivate);
};

window.expandInlineReview = function (btn) {
  const p = btn.parentElement;
  const fullText = p.getAttribute("data-full-text");
  p.innerHTML = `${fullText} <button class="inline-more-btn" onclick="collapseInlineReview(this)">less</button>`;
};

window.collapseInlineReview = function (btn) {
  const p = btn.parentElement;
  const fullText = p.getAttribute("data-full-text");
  const MAX_CHARS = 150;
  const truncatedText = fullText.substring(0, MAX_CHARS);
  p.innerHTML = `${truncatedText}... <button class="inline-more-btn" onclick="expandInlineReview(this)">more</button>`;
};

window.selectDropdownOption = function (optionElement, targetSpanId) {
  const target = document.getElementById(targetSpanId);
  if (target) {
    target.textContent = optionElement.textContent.trim();
  }
  const details = optionElement.closest("details");
  if (details) {
    details.removeAttribute("open");
  }
};

// Edit profile modal initialization and handlers
function setupEditModal() {
  const modal = document.getElementById("editProfileModal");
  const openBtn = document.getElementById("editProfileBtn");
  const closeBtn = document.getElementById("closeEditModal");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const saveBtn = modal ? modal.querySelector(".btn-save") : null;

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    });
  }

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Avatar and backdrop real-time previews
  const avatarUpload = document.getElementById("avatarUpload");
  const editAvatarPreview = document.getElementById("editAvatarPreview");

  if (avatarUpload && editAvatarPreview) {
    avatarUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          editAvatarPreview.src = e.target.result;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const backdropUpload = document.getElementById("backdropUpload");
  const editBannerPreview = document.getElementById("editBannerPreview");

  if (backdropUpload && editBannerPreview) {
    backdropUpload.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          editBannerPreview.style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  // Submit profile edit form
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const inputs = modal.querySelectorAll(".edit-input");
      if (inputs.length < 3) return;

      const displayName = inputs[0].value.trim();
      const username = inputs[1].value.trim();
      const bio = inputs[2].value.trim();

      const selectedOptions = modal.querySelectorAll(".custom-option.selected");
      const genre1 =
        selectedOptions.length > 0
          ? selectedOptions[0].getAttribute("data-value")
          : "";
      const genre2 =
        selectedOptions.length > 1
          ? selectedOptions[1].getAttribute("data-value")
          : "";

      const formData = new FormData();
      formData.append("displayName", displayName);
      formData.append("username", username);
      formData.append("bio", bio);
      formData.append("genre1", genre1);
      formData.append("genre2", genre2);

      if (avatarUpload && avatarUpload.files[0]) {
        formData.append("avatar", avatarUpload.files[0]);
      }
      if (backdropUpload && backdropUpload.files[0]) {
        formData.append("backdrop", backdropUpload.files[0]);
      }

      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        const response = await fetch("/edit-profile", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          window.location.href = `/profile/${data.newUsername}`;
        } else {
          alert(data.error || "Failed to update profile");
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }
      } catch (error) {
        console.error("Error:", error);
        alert("Server connection failed.");
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    });
  }
}

// Create list modal inside profile
function setupCreateListModal() {
  const addedItemsContainer = document.getElementById("addedItemsContainer");
  const createListModal = document.getElementById("createListModal");
  const openCreateListBtn = document.getElementById("openCreateListBtnProfile");
  const closeBtn = document.getElementById("closeCreateListBtn");
  const cancelBtn = document.getElementById("cancelListBtn");

  function openModal() {
    if (createListModal) createListModal.style.display = "flex";
  }

  function closeModal() {
    if (createListModal) createListModal.style.display = "none";
  }

  if (openCreateListBtn) openCreateListBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === createListModal) closeModal();
  });

  // Drag and drop sorting for list items
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
    if (draggedItem !== this && addedItemsContainer) {
      let allItems = [
        ...addedItemsContainer.querySelectorAll(".modal-mini-card"),
      ];
      let draggedIdx = allItems.indexOf(draggedItem);
      let droppedIdx = allItems.indexOf(this);

      if (draggedIdx < droppedIdx) {
        this.after(draggedItem);
      } else {
        this.before(draggedItem);
      }
    }
  }

  function addDragEvents(item) {
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragend", handleDragEnd);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("dragleave", handleDragLeave);
    item.addEventListener("drop", handleDrop);
  }

  document.querySelectorAll(".modal-mini-card").forEach(addDragEvents);

  if (addedItemsContainer) {
    addedItemsContainer.addEventListener("click", function (e) {
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
}

// Profile page event listeners
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has("mode")) {
    window.setProfileMode(urlParams.get("mode"));
  }

  if (urlParams.has("private")) {
    window.setPrivacyMode(urlParams.get("private") === "true");
  }

  const reviewBodies = document.querySelectorAll(".review-body");
  const MAX_CHARS = 150;

  reviewBodies.forEach((p) => {
    const fullText = p.getAttribute("data-full-text") || p.innerText.trim();
    p.setAttribute("data-full-text", fullText);

    if (fullText.length > MAX_CHARS && !p.classList.contains("blurred")) {
      const truncatedText = fullText.substring(0, MAX_CHARS);
      p.innerHTML = `${truncatedText}... <button class="inline-more-btn" onclick="expandInlineReview(this)">more</button>`;
    } else if (!p.classList.contains("blurred")) {
      p.innerHTML = fullText;
    }
  });

  // Follow/unfollow toggle interaction
  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    followBtn.addEventListener("click", async () => {
      const followingId = followBtn.getAttribute("data-id");
      const isPrivate = document.body.classList.contains("is-private");

      if (!followingId) return;

      followBtn.disabled = true;
      const originalText = followBtn.querySelector(".btn-label").textContent;
      followBtn.querySelector(".btn-label").textContent = "...";

      try {
        const response = await fetch("/api/follow/toggle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ followingId: followingId }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.status === "followed") {
            if (isPrivate) {
              window.setFollowState("requested");
            } else {
              window.setFollowState("following");
            }
          } else if (data.status === "unfollowed") {
            window.setFollowState("none");
          }
        } else {
          alert(data.error || "Something went wrong.");
          followBtn.querySelector(".btn-label").textContent = originalText;
        }
      } catch (error) {
        console.error("Follow error:", error);
        alert("Failed to connect to the server.");
        followBtn.querySelector(".btn-label").textContent = originalText;
      } finally {
        followBtn.disabled = false;
      }
    });
  }

  // Custom select wrappers handling
  document.querySelectorAll(".custom-select-wrapper").forEach((wrapper) => {
    const trigger = wrapper.querySelector(".custom-select-trigger");
    const triggerSpan = trigger ? trigger.querySelector("span") : null;
    const optionsContainer = wrapper.querySelector(".custom-select-options");
    const optionsList = wrapper.querySelectorAll(".custom-option");

    if (trigger && optionsContainer) {
      trigger.addEventListener("click", function (e) {
        document.querySelectorAll(".custom-select-options").forEach((opt) => {
          if (opt !== optionsContainer) opt.classList.remove("open");
        });
        optionsContainer.classList.toggle("open");
        e.stopPropagation();
      });
    }

    optionsList.forEach((option) => {
      option.addEventListener("click", function (e) {
        if (triggerSpan) triggerSpan.textContent = this.textContent.trim();
        optionsList.forEach((opt) => opt.classList.remove("selected"));
        this.classList.add("selected");
        if (optionsContainer) optionsContainer.classList.remove("open");
        e.stopPropagation();
      });
    });
  });

  document.addEventListener("click", function () {
    document.querySelectorAll(".custom-select-options").forEach((opt) => {
      opt.classList.remove("open");
    });
  });

  // Community list like toggle
  document.querySelectorAll(".list-action-btn.like-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const listId = this.getAttribute("data-list-id");
      if (!listId) return;

      try {
        const response = await fetch(`/api/lists/${listId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          const countSpan =
            this.querySelector(".like-count") || this.querySelector("span");
          let count = parseInt(countSpan.textContent, 10) || 0;

          if (data.status === "added") {
            this.classList.add("is-liked");
            countSpan.textContent = count + 1;
          } else if (data.status === "removed") {
            this.classList.remove("is-liked");
            countSpan.textContent = Math.max(0, count - 1);
          }
        } else if (response.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (error) {
        console.error("Error toggling list like:", error);
      }
    });
  });

  // Review like toggle
  document.querySelectorAll(".review-like-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();

      const reviewId = this.getAttribute("data-review-id");
      if (!reviewId) return;

      try {
        const response = await fetch(`/api/reviews/${reviewId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          const countSpan =
            this.querySelector(".like-count") || this.querySelector("span");
          const icon = this.querySelector("i");
          let count = parseInt(countSpan.textContent, 10) || 0;

          if (data.status === "added") {
            this.classList.add("is-liked");
            countSpan.textContent = count + 1;
            if (icon) icon.classList.replace("fa-regular", "fa-solid");
          } else if (data.status === "removed") {
            this.classList.remove("is-liked");
            countSpan.textContent = Math.max(0, count - 1);
            if (icon) icon.classList.replace("fa-solid", "fa-regular");
          }
        } else if (response.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (error) {
        console.error("Error toggling like:", error);
      }
    });
  });

  setupEditModal();
  setupCreateListModal();

  // Remove media from profile favorites
  window.toggleFavoriteProfile = async function (
    btnElement,
    tmdbId,
    mediaType,
  ) {
    const originalHTML = btnElement.innerHTML;

    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.1rem; color: #a0aec0;"></i>`;
    btnElement.disabled = true;

    try {
      const response = await fetch("/api/like/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
      });

      if (response.ok) {
        const card = btnElement.closest(".content-card");
        if (card) {
          card.style.transition = "all 0.3s ease";
          card.style.transform = "scale(0.8)";
          card.style.opacity = "0";
          setTimeout(() => {
            card.remove();
          }, 300);
        }
      } else {
        const data = await response.json();
        alert(data.error || "Something went wrong.");
        btnElement.innerHTML = originalHTML;
        btnElement.disabled = false;
      }
    } catch (error) {
      console.error("Error removing from favorites:", error);
      alert("Failed to connect to the server.");
      btnElement.innerHTML = originalHTML;
      btnElement.disabled = false;
    }
  };

  // Review tab filtering and sorting engine
  const spoilersToggle = document.querySelector(
    '.spoiler-toggle-wrapper input[type="checkbox"]',
  );
  const reviewsFeed = document.querySelector(".minimal-reviews-feed");

  function applyFilters() {
    if (!reviewsFeed) return;

    const reviewCards = Array.from(
      reviewsFeed.querySelectorAll(".minimal-review-card"),
    );

    const reviewFilters = document.querySelectorAll(
      "#reviews-sidebar-content .custom-select-options",
    );

    const selectedMediaOption = reviewFilters[0]?.querySelector(
      ".custom-option.selected",
    );
    const selectedRatingOption = reviewFilters[1]?.querySelector(
      ".custom-option.selected",
    );
    const selectedSortOption = reviewFilters[2]?.querySelector(
      ".custom-option.selected",
    );

    const showSpoilers = spoilersToggle ? spoilersToggle.checked : true;
    const selectedMedia = selectedMediaOption
      ? selectedMediaOption.getAttribute("data-value")
      : "all";
    const selectedRating = selectedRatingOption
      ? selectedRatingOption.getAttribute("data-value")
      : "any";
    const selectedSort = selectedSortOption
      ? selectedSortOption.getAttribute("data-value")
      : "newest";

    let visibleCards = [];

    reviewCards.forEach((card) => {
      const cardType = card.dataset.type;
      const cardRating = parseFloat(card.dataset.rating) || 0;
      const cardSpoiler = card.dataset.spoiler === "true";

      let isMatch = true;

      if (!showSpoilers && cardSpoiler) isMatch = false;

      if (selectedMedia !== "all") {
        const expectedType =
          selectedMedia === "movies" ? "movie" : selectedMedia;
        if (cardType !== expectedType) isMatch = false;
      }

      if (selectedRating !== "any") {
        const requiredRating = parseFloat(selectedRating);
        if (cardRating < requiredRating) isMatch = false;
      }

      if (isMatch) {
        card.style.display = "flex";
        visibleCards.push(card);
      } else {
        card.style.display = "none";
      }
    });

    visibleCards.sort((a, b) => {
      const timeA = parseInt(a.dataset.timestamp, 10) || 0;
      const timeB = parseInt(b.dataset.timestamp, 10) || 0;
      const ratingA = parseFloat(a.dataset.rating) || 0;
      const ratingB = parseFloat(b.dataset.rating) || 0;

      if (selectedSort === "newest") return timeB - timeA;
      if (selectedSort === "oldest") return timeA - timeB;
      if (selectedSort === "highest") return ratingB - ratingA;
      if (selectedSort === "lowest") return ratingA - ratingB;

      return timeB - timeA;
    });

    reviewsFeed
      .querySelectorAll(".review-divider")
      .forEach((hr) => hr.remove());

    const filterEmptyState = document.getElementById("filterEmptyState");

    if (visibleCards.length === 0) {
      if (filterEmptyState) filterEmptyState.style.display = "block";
    } else {
      if (filterEmptyState) filterEmptyState.style.display = "none";

      visibleCards.forEach((card, index) => {
        reviewsFeed.appendChild(card);

        if (index < visibleCards.length - 1) {
          const hr = document.createElement("hr");
          hr.className = "review-divider";
          reviewsFeed.appendChild(hr);
        }
      });

      if (filterEmptyState) reviewsFeed.appendChild(filterEmptyState);
    }
  }

  if (spoilersToggle) {
    spoilersToggle.addEventListener("change", applyFilters);
  }

  const reviewFilterOptions = document.querySelectorAll(
    "#reviews-sidebar-content .custom-option",
  );
  reviewFilterOptions.forEach((option) => {
    option.addEventListener("click", () => {
      setTimeout(applyFilters, 50);
    });
  });
});
