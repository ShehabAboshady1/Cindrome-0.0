document.addEventListener("DOMContentLoaded", () => {
  const tabBtns = document.querySelectorAll(".settings-tab-btn");
  const panels = document.querySelectorAll(".settings-panel");

  function switchTab(targetTabId, activeBtn) {
    panels.forEach((panel) => {
      panel.style.display = "none";
    });
    const targetPanel = document.getElementById(`tab-${targetTabId}`);
    if (targetPanel) targetPanel.style.display = "block";

    tabBtns.forEach((btn) => btn.classList.remove("is-active"));
    if (activeBtn) activeBtn.classList.add("is-active");
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      switchTab(this.getAttribute("data-tab"), this);
    });
  });

  // ==================================================
  // حفظ إعدادات الخصوصية والإشعارات (Preferences)
  // ==================================================
  async function savePreferences(btnElement) {
    const isPrivate =
      document.getElementById("privateAccountToggle")?.checked || false;
    const notifyFollowers =
      document.getElementById("notifyFollowersToggle")?.checked || false;
    const notifyReviews =
      document.getElementById("notifyReviewsToggle")?.checked || false;

    try {
      const response = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_private: isPrivate,
          notify_new_follower: notifyFollowers,
          notify_review_interaction: notifyReviews,
        }),
      });

      if (response.ok) {
        const originalText = btnElement.textContent;
        btnElement.textContent = "Saved Successfully";
        btnElement.style.backgroundColor = "#0be3e3";
        setTimeout(() => {
          btnElement.textContent = originalText;
          btnElement.style.backgroundColor = "";
        }, 2000);
      } else {
        alert("Failed to save settings.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Server connection failed.");
    }
  }

  const savePrivacyBtn = document.getElementById("savePrivacyBtn");
  if (savePrivacyBtn)
    savePrivacyBtn.addEventListener("click", () =>
      savePreferences(savePrivacyBtn),
    );

  const saveNotificationsBtn = document.getElementById("saveNotificationsBtn");
  if (saveNotificationsBtn)
    saveNotificationsBtn.addEventListener("click", () =>
      savePreferences(saveNotificationsBtn),
    );

  // ==================================================
  // تحديث الأمان (تغيير الإيميل والباسورد)
  // ==================================================
  const updatePasswordBtn = document.getElementById("updatePasswordBtn");
  const changeEmailBtn = document.getElementById("changeEmailBtn");

  async function updateSecurity(btnElement, type) {
    const newEmail = document.getElementById("newEmailInput")?.value.trim();
    const currentPassword = document
      .getElementById("currentPasswordInput")
      ?.value.trim();
    const newPassword = document
      .getElementById("newPasswordInput")
      ?.value.trim();
    const confirmPassword = document
      .getElementById("confirmPasswordInput")
      ?.value.trim();

    const payload = {};

    if (type === "email") {
      if (!newEmail) return alert("Please enter a new email.");
      payload.newEmail = newEmail;
    } else if (type === "password") {
      if (!currentPassword || !newPassword || !confirmPassword)
        return alert("Please fill in all password fields.");
      if (newPassword !== confirmPassword)
        return alert("New passwords do not match.");
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const response = await fetch("/api/settings/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const originalText = btnElement.textContent;
        btnElement.textContent = "Updated Successfully";
        setTimeout(() => {
          btnElement.textContent = originalText;
          if (type === "email")
            document.getElementById("newEmailInput").value = "";
          if (type === "password") {
            document.getElementById("currentPasswordInput").value = "";
            document.getElementById("newPasswordInput").value = "";
            document.getElementById("confirmPasswordInput").value = "";
          }
        }, 2000);
      } else {
        alert(data.error || "Failed to update security settings.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Server connection failed.");
    }
  }

  if (changeEmailBtn)
    changeEmailBtn.addEventListener("click", () =>
      updateSecurity(changeEmailBtn, "email"),
    );
  if (updatePasswordBtn)
    updatePasswordBtn.addEventListener("click", () =>
      updateSecurity(updatePasswordBtn, "password"),
    );

  // ==================================================
  // نافذة تأكيد حذف الحساب (Delete Account Modal)
  // ==================================================
  const deleteModal = document.getElementById("deleteAccountModal");
  const openDeleteBtn = document.getElementById("openDeleteModalBtn");
  const closeDeleteBtn = document.getElementById("closeDeleteModalBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  function closeDeleteModal() {
    if (deleteModal) deleteModal.style.display = "none";
  }

  if (openDeleteBtn)
    openDeleteBtn.addEventListener("click", () => {
      if (deleteModal) deleteModal.style.display = "flex";
    });
  if (closeDeleteBtn)
    closeDeleteBtn.addEventListener("click", closeDeleteModal);
  if (cancelDeleteBtn)
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  window.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/settings/account", {
          method: "DELETE",
        });
        if (response.ok) {
          localStorage.clear();
          window.location.href = "/sign-in";
        } else {
          alert("Failed to delete account. Please try again.");
        }
      } catch (error) {
        console.error("Error:", error);
        alert("Server connection failed.");
      }
    });
  }
});
