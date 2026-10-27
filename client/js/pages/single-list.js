document.addEventListener("DOMContentLoaded", () => {
  // =========================================================
  // 1. تفعيل أزرار المودال (Like, Rewatch, Spoiler)
  // =========================================================
  const likeBtn = document.getElementById("likeToggle");
  const rewatchBtn = document.getElementById("rewatchToggle");
  const spoilerToggleBtn = document.getElementById("spoilerToggle");

  function toggleLogButton(btn, activeClass) {
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle(activeClass);
      if (activeClass === "spoiler-active") {
        this.classList.remove("active");
      } else {
        this.classList.remove("spoiler-active");
      }
    });
  }

  toggleLogButton(likeBtn, "active");
  toggleLogButton(rewatchBtn, "active");
  toggleLogButton(spoilerToggleBtn, "spoiler-active");

  // =========================================================
  // 2. أزرار الهيدر (Like List, Share)
  // =========================================================
  const listLikeBtn = document.querySelector(
    ".single-list-actions-inline .like-btn",
  );
  const shareBtn = document.querySelector(
    ".single-list-actions-inline .share-btn",
  );

  if (listLikeBtn) {
    listLikeBtn.addEventListener("click", () => {
      listLikeBtn.classList.toggle("is-liked");
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const span = shareBtn.querySelector("span");
      const originalText = span.textContent;
      try {
        await navigator.clipboard.writeText(window.location.href);
        span.textContent = "Copied!";
        shareBtn.classList.add("is-copied");
        setTimeout(() => {
          span.textContent = originalText;
          shareBtn.classList.remove("is-copied");
        }, 2000);
      } catch (err) {
        const dummy = document.createElement("input");
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        span.textContent = "Copied!";
        setTimeout(() => (span.textContent = originalText), 2000);
      }
    });
  }

  // =========================================================
  // 3. الكروت وأزرار القائمة (Delete, Add, Fav)
  // =========================================================

  // تفعيل زرار مسح القائمة (Custom Modal)
  const deleteListBtn = document.getElementById("deleteListBtn");
  const deleteListModal = document.getElementById("deleteListModal");
  const cancelDeleteListBtn = document.getElementById("cancelDeleteListBtn");
  const confirmDeleteListBtn = document.getElementById("confirmDeleteListBtn");

  if (deleteListBtn && deleteListModal) {
    // 1. فتح المودال لما ندوس على زرار Delete List
    deleteListBtn.addEventListener("click", () => {
      deleteListModal.style.display = "flex";
    });

    // 2. قفل المودال لما ندوس Cancel
    cancelDeleteListBtn.addEventListener("click", () => {
      deleteListModal.style.display = "none";
    });

    // 3. قفل المودال لو دوسنا بره في الخلفية السودا
    deleteListModal.addEventListener("click", (e) => {
      if (e.target === deleteListModal) {
        deleteListModal.style.display = "none";
      }
    });

    // 4. تنفيذ المسح الحقيقي لما ندوس Delete في المودال
    confirmDeleteListBtn.addEventListener("click", async () => {
      const listId = deleteListBtn.getAttribute("data-list-id");
      const originalText = confirmDeleteListBtn.innerHTML;

      confirmDeleteListBtn.innerHTML = "Deleting...";
      confirmDeleteListBtn.disabled = true;
      confirmDeleteListBtn.style.opacity = "0.7";

      try {
        const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
        const data = await res.json(); // نقرا الداتا اللي رجعت من السيرفر

        if (res.ok) {
          // نستخدم الـ username الحقيقي اللي جي من الباك إند
          window.location.href = `/profile/${data.username}`;
        } else {
          alert(data.error || "Failed to delete the list. Please try again.");
          confirmDeleteListBtn.innerHTML = originalText;
          confirmDeleteListBtn.disabled = false;
          confirmDeleteListBtn.style.opacity = "1";
          deleteListModal.style.display = "none";
        }
      } catch (err) {
        alert("Network error.");
        confirmDeleteListBtn.innerHTML = originalText;
        confirmDeleteListBtn.disabled = false;
        confirmDeleteListBtn.style.opacity = "1";
        deleteListModal.style.display = "none";
      }
    });
  }

  // تفعيل زراير הכروت (لايك ووتش ليست للميديا)
  const cardsGrid = document.querySelector(".single-list-cards-grid");
  const plusIconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const minusIconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

  if (cardsGrid) {
    cardsGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".mini-content-card");
      if (!card) return;

      const tmdb_id = card.dataset.id;
      const media_type = card.dataset.type;

      // لو داس على زرار الوتش ليست (+)
      const addBtn = e.target.closest(".btn-add");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();

        // نكلم الداتابيز عشان نضيفه/نمسحه بجد
        fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdb_id, media_type }),
        });

        const isAdded = addBtn.classList.toggle("is-added");
        addBtn.innerHTML = isAdded ? minusIconSvg : plusIconSvg;
        addBtn.setAttribute(
          "title",
          isAdded ? "Remove from Watchlist" : "Add to Watchlist",
        );
        return;
      }

      // لو داس على القلب (Fav)
      const favBtn = e.target.closest(".btn-fav");
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();

        // نكلم الداتابيز عشان يعمل لايك بجد
        fetch("/api/like/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdb_id, media_type }),
        });

        favBtn.classList.toggle("is-favorited");
        return;
      }

      // بار الموبايل
      if (window.innerWidth <= 768) {
        document
          .querySelectorAll(".mini-content-card.show-bar")
          .forEach((c) => {
            if (c !== card) c.classList.remove("show-bar");
          });
        card.classList.toggle("show-bar");
      }
    });
  }

  // =========================================================
  // 4. التعليقات والردود بالتداخل الشجري (Clean JS via Templates)
  // =========================================================
  const commentsList = document.querySelector(".comments-list");
  const mainCommentTextarea = document.querySelector(
    ".add-comment-box .comment-textarea",
  );
  const mainPostBtn = document.querySelector(
    ".add-comment-box .modern-post-btn",
  );
  const commentsCountHeader = document.querySelector(".comments-count");
  const mainCommentTemplate = document.getElementById("mainCommentTemplate");
  const replyCommentTemplate = document.getElementById("replyCommentTemplate");

  // استخراج اليوزر الحالي من النافبار لو متاح
  let currentUsername = "You";
  const navUserLink = document.querySelector(".nav-username");
  if (navUserLink) {
    currentUsername = navUserLink.textContent.trim().replace("@", "");
  }

  function updateCommentsCount(change = 1) {
    if (!commentsCountHeader) return;
    let count = parseInt(commentsCountHeader.textContent, 10) || 0;
    count += change;
    commentsCountHeader.textContent = count;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // نشر تعليق أساسي
  function postMainComment() {
    if (!mainCommentTextarea || !mainCommentTemplate) return;
    const text = mainCommentTextarea.value.trim();
    if (!text) {
      mainCommentTextarea.focus();
      return;
    }

    const clone = mainCommentTemplate.content.cloneNode(true);
    const newThread = clone.querySelector(".comment-thread");

    newThread.querySelector(".comment-user").textContent =
      `@${currentUsername}`;
    newThread.querySelector(".comment-text").innerHTML = escapeHtml(text);
    newThread.querySelector(".comment-textarea").placeholder =
      `Reply to @${currentUsername}...`;

    commentsList.prepend(newThread);
    mainCommentTextarea.value = "";
    updateCommentsCount(1);
  }

  if (mainPostBtn) mainPostBtn.addEventListener("click", postMainComment);
  if (mainCommentTextarea) {
    mainCommentTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        postMainComment();
      }
    });
  }

  // نشر رد
  function submitReply(replyBox) {
    if (!replyCommentTemplate) return;
    const textarea = replyBox.querySelector(".comment-textarea");
    const replyText = textarea.value.trim();
    if (!replyText) {
      textarea.focus();
      return;
    }

    const thread = replyBox.closest(".comment-thread");
    const parentComment = replyBox.closest(".single-comment");
    const isReplyingToNested =
      parentComment &&
      (parentComment.classList.contains("reply-comment") ||
        parentComment.classList.contains("sub-reply-comment"));

    let targetContainer;
    let isSubReply = false;

    if (isReplyingToNested) {
      isSubReply = true;
      const existingSub = parentComment.closest(".sub-nested-replies");
      if (existingSub) {
        targetContainer = existingSub;
      } else {
        let nextEl = parentComment.nextElementSibling;
        if (nextEl && nextEl.classList.contains("sub-nested-replies")) {
          targetContainer = nextEl;
        } else {
          targetContainer = document.createElement("div");
          targetContainer.className = "sub-nested-replies";
          parentComment.after(targetContainer);
        }
      }
    } else {
      let nestedContainer = thread.querySelector(".nested-replies");
      if (!nestedContainer) {
        nestedContainer = document.createElement("div");
        nestedContainer.className = "nested-replies";
        thread.appendChild(nestedContainer);
      }
      targetContainer = nestedContainer;
    }

    const replyTo = replyBox.dataset.replyTo;
    const mentionPrefix =
      isSubReply && replyTo
        ? `<span class="comment-mention">${escapeHtml(replyTo)}</span> `
        : "";

    const clone = replyCommentTemplate.content.cloneNode(true);
    const newReply = clone.querySelector(".single-comment");
    newReply.classList.add(isSubReply ? "sub-reply-comment" : "reply-comment");

    newReply.querySelector(".comment-user").textContent = `@${currentUsername}`;
    newReply.querySelector(".comment-text").innerHTML =
      mentionPrefix + escapeHtml(replyText);
    newReply.querySelector(".comment-textarea").placeholder =
      `Reply to @${currentUsername}...`;

    targetContainer.appendChild(newReply);
    textarea.value = "";
    delete replyBox.dataset.replyTo;
    replyBox.classList.remove("is-active");
    updateCommentsCount(1);
  }

  // تفاعلات التعليقات
  if (commentsList) {
    commentsList.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const replyTextarea = e.target.closest(
          ".inline-reply-box .comment-textarea",
        );
        if (replyTextarea) {
          e.preventDefault();
          const replyBox = replyTextarea.closest(".inline-reply-box");
          if (replyBox) submitReply(replyBox);
        }
      }
    });

    commentsList.addEventListener("click", (e) => {
      // فتح الرد
      const replyBtn = e.target.closest(".reply-trigger");
      if (replyBtn) {
        const commentWrapper = replyBtn.closest(".comment-content-wrapper");
        const replyBox = commentWrapper.querySelector(".inline-reply-box");

        if (replyBox) {
          document
            .querySelectorAll(".inline-reply-box.is-active")
            .forEach((b) => {
              if (b !== replyBox) b.classList.remove("is-active");
            });

          const isNestedComment =
            !!replyBtn.closest(".reply-comment") ||
            !!replyBtn.closest(".sub-reply-comment");
          const targetUser =
            commentWrapper.querySelector(".comment-user")?.textContent.trim() ||
            "";

          if (isNestedComment && targetUser) {
            replyBox.dataset.replyTo = targetUser;
          } else {
            delete replyBox.dataset.replyTo;
          }

          replyBox.classList.toggle("is-active");
          if (replyBox.classList.contains("is-active")) {
            const area = replyBox.querySelector(".comment-textarea");
            if (area) {
              area.placeholder = targetUser
                ? `Reply to ${targetUser}...`
                : `Reply to comment...`;
              area.focus();
            }
          }
        }
        return;
      }

      // إلغاء الرد
      const cancelBtn = e.target.closest(".reply-cancel-btn");
      if (cancelBtn) {
        const replyBox = cancelBtn.closest(".inline-reply-box");
        if (replyBox) {
          delete replyBox.dataset.replyTo;
          replyBox.classList.remove("is-active");
          const area = replyBox.querySelector(".comment-textarea");
          if (area) area.value = "";
        }
        return;
      }

      // إرسال الرد
      const sendReplyBtn = e.target.closest(
        ".inline-reply-box .modern-post-btn",
      );
      if (sendReplyBtn) {
        const replyBox = sendReplyBtn.closest(".inline-reply-box");
        if (replyBox) submitReply(replyBox);
        return;
      }

      // لايك للتعليق
      const likeCommentBtn = e.target.closest(".interaction-btn");
      if (
        likeCommentBtn &&
        !likeCommentBtn.classList.contains("reply-trigger")
      ) {
        const isLiked = likeCommentBtn.classList.toggle("is-liked");
        const span = likeCommentBtn.querySelector("span");
        let currentNum = parseInt(span.textContent.trim(), 10) || 0;
        span.textContent = isLiked
          ? currentNum + 1
          : Math.max(0, currentNum - 1);
      }
    });
  }
  // =========================================================
  // 5. زرار تعديل القائمة (Edit List) - النسخة الآمنة
  // =========================================================
  const editListTriggerBtn = document.getElementById("editListTriggerBtn");

  if (editListTriggerBtn) {
    editListTriggerBtn.addEventListener("click", () => {
      const dataHelper = document.getElementById("listDataHelper");

      if (!dataHelper) {
        alert("Error: Data helper not found.");
        return;
      }

      try {
        // قراءة البيانات من الـ HTML وتحويلها لكائنات جافاسكريبت
        const currentList = JSON.parse(dataHelper.getAttribute("data-list"));
        const currentListItems = JSON.parse(
          dataHelper.getAttribute("data-items"),
        );

        if (!currentList || !currentList.id) {
          alert("Data is still loading, please wait...");
          return;
        }

        // نبعت إشارة لملف modals.js عشان يفتح المودال ويفرش فيه الداتا
        const event = new CustomEvent("openEditListMode", {
          detail: {
            list: currentList,
            items: currentListItems,
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error("Error parsing list data:", error);
        alert("Failed to load list data for editing.");
      }
    });
  }
});
