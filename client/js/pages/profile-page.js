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
  const saveBtn = modal ? modal.querySelector(".btn-save") : null;

  // =====================================
  // 1. فتح وإغلاق المودال
  // =====================================
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

  // =====================================
  // 2. المعاينة المباشرة للصور قبل الحفظ
  // =====================================
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

  // =====================================
  // 3. تجميع البيانات وإرسالها للسيرفر
  // =====================================
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
}

// ==========================================
// 🌟 تشغيل الأحداث (EventListeners)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const savedPrivacy = localStorage.getItem("cindrome_is_private");
  if (savedPrivacy !== null) {
    window.setPrivacyMode(savedPrivacy === "true");
  }
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

  // 2. زرار المتابعة (يكلم السيرفر للتبديل الفعلي)
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
