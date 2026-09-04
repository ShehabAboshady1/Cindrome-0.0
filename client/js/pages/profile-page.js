// ==========================================
// 🌟 دوال التحكم والتنقل العامة
// ==========================================

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

window.setNotificationState = function (isEnabled) {
  const notifyBtn = document.getElementById("notifyBtn");
  if (!notifyBtn) return;

  notifyBtn.classList.toggle("is-active", isEnabled);
  notifyBtn.setAttribute("aria-pressed", String(isEnabled));
  notifyBtn.setAttribute(
    "aria-label",
    isEnabled ? "Turn off notifications" : "Turn on notifications",
  );
  notifyBtn.title = isEnabled
    ? "Turn off notifications"
    : "Turn on notifications";
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

function setupEditModal() {
  const modal = document.getElementById("editProfileModal");
  const openBtn = document.getElementById("editProfileBtn");
  const closeBtn = document.getElementById("closeEditModal");
  const cancelBtn = document.getElementById("cancelEditBtn");

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
}

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

  const searchInput = document.getElementById("addMovieSearch");
  if (searchInput && addedItemsContainer) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter" && this.value.trim() !== "") {
        e.preventDefault();

        const newCard = document.createElement("div");
        newCard.className = "mini-content-card modal-mini-card";
        newCard.draggable = true;
        newCard.innerHTML = `
                    <div class="mini-card-media">
                        <img src="https://image.tmdb.org/t/p/w200/8bZCaPAPPil3ea2c9xSsmfsibGB.jpg" class="mini-card-poster" alt="New">
                    </div>
                    <button class="remove-mini-btn" title="Remove"><i class="fa-solid fa-xmark"></i></button>
                `;

        addedItemsContainer.prepend(newCard);
        addDragEvents(newCard);
        this.value = "";
      }
    });
  }
}

// ==========================================
// 🌟 تشغيل الأحداث (EventListeners)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // قراءة حالة الخصوصية المحفوظة من صفحة الإعدادات
  const savedPrivacy = localStorage.getItem("cindrome_is_private");
  if (savedPrivacy !== null) {
    window.setPrivacyMode(savedPrivacy === "true");
  }
  // 🌟 قراءة الأوضاع تلقائياً من رابط الصفحة للتجربة على الموبايل 🌟
  const urlParams = new URLSearchParams(window.location.search);

  // إذا كاتب في الرابط mode=other أو mode=self
  if (urlParams.has("mode")) {
    window.setProfileMode(urlParams.get("mode"));
  }

  // إذا كاتب في الرابط private=true أو private=false
  if (urlParams.has("private")) {
    window.setPrivacyMode(urlParams.get("private") === "true");
  }
  // 1. اختصار نصوص المراجعات
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

  // 2. زرار المتابعة (يتعرف تلقائياً إذا كان الحساب خاصاً ليعرض Requested)
  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    followBtn.addEventListener("click", () => {
      const isPrivate = document.body.classList.contains("is-private");
      const isCurrentlyRequested = followBtn.classList.contains("is-requested");
      const isCurrentlyFollowing = followBtn.classList.contains("is-active");

      if (isPrivate) {
        if (isCurrentlyRequested) {
          window.setFollowState("none");
        } else {
          window.setFollowState("requested");
        }
      } else {
        if (isCurrentlyFollowing) {
          window.setFollowState("none");
        } else {
          window.setFollowState("following");
        }
      }
    });
  }

  // 3. زرار الإشعارات
  const notifyBtn = document.getElementById("notifyBtn");
  if (notifyBtn) {
    let isNotifying = false;
    notifyBtn.addEventListener("click", () => {
      isNotifying = !isNotifying;
      window.setNotificationState(isNotifying);
    });
  }

  // 4. القوائم المنسدلة المخصصة
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

  // 5. تحويل زرار (+) لـ (-) في كروت الـ Favorites
  document.querySelectorAll(".btn-watchlist").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.toggle("added");
      this.textContent = this.classList.contains("added") ? "−" : "+";
    });
  });

  // 6. تفعيل زرار الإعجاب لكروت الـ Lists
  document.querySelectorAll(".list-action-btn.like-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.toggle("liked");
    });
  });

  // 7. تفعيل زرار الإعجاب لكروت الـ Reviews
  document.querySelectorAll(".review-like-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("liked");
      const icon = this.querySelector("i");
      if (icon) {
        if (this.classList.contains("liked")) {
          icon.classList.remove("fa-regular");
          icon.classList.add("fa-solid");
        } else {
          icon.classList.remove("fa-solid");
          icon.classList.add("fa-regular");
        }
      }
    });
  });

  setupEditModal();
  setupCreateListModal();
});
