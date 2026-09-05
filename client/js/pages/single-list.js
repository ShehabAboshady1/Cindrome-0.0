document.addEventListener("DOMContentLoaded", () => {
  // 1. أزرار الهيدر
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

  // 2. الكروت
  const cardsGrid = document.querySelector(".single-list-cards-grid");
  const plusIconSvg = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
  const minusIconSvg = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;

  if (cardsGrid) {
    cardsGrid.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".btn-add");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const isAdded = addBtn.classList.toggle("is-added");
        addBtn.innerHTML = isAdded ? minusIconSvg : plusIconSvg;
        addBtn.setAttribute(
          "title",
          isAdded ? "Remove from Watchlist" : "Add to Watchlist",
        );
        return;
      }

      const favBtn = e.target.closest(".btn-fav");
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        favBtn.classList.toggle("is-favorited");
        return;
      }

      const card = e.target.closest(".mini-content-card");
      if (card && window.innerWidth <= 768) {
        document
          .querySelectorAll(".mini-content-card.show-bar")
          .forEach((c) => {
            if (c !== card) c.classList.remove("show-bar");
          });
        card.classList.toggle("show-bar");
      }
    });
  }

  // 3. التعليقات والردود بالتداخل الشجري
  const commentsList = document.querySelector(".comments-list");
  const mainCommentTextarea = document.querySelector(
    ".add-comment-box .comment-textarea",
  );
  const mainPostBtn = document.querySelector(
    ".add-comment-box .modern-post-btn",
  );
  const commentsCountHeader = document.querySelector(".comments-count");
  const currentUsername = localStorage.getItem("cindrome_username") || "You";

  function updateCommentsCount(change = 1) {
    if (!commentsCountHeader) return;
    let count = parseInt(commentsCountHeader.textContent, 10) || 0;
    count += change;
    commentsCountHeader.textContent = count;
  }

  function postMainComment() {
    if (!mainCommentTextarea) return;
    const text = mainCommentTextarea.value.trim();
    if (!text) {
      mainCommentTextarea.focus();
      return;
    }

    const newCommentThread = document.createElement("div");
    newCommentThread.className = "comment-thread";
    newCommentThread.innerHTML = `
            <div class="single-comment">
                <img src="../assets/logos/cindrome-logo.png" alt="User" class="comment-avatar">
                <div class="comment-content-wrapper">
                    <div class="comment-header">
                        <span class="comment-user">@${currentUsername}</span>
                        <span class="comment-time">Just now</span>
                    </div>
                    <p class="comment-text">${escapeHtml(text)}</p>
                    <div class="comment-interactions">
                        <button class="interaction-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg> 0
                        </button>
                        <button class="interaction-btn reply-trigger">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg> Reply
                        </button>
                    </div>
                    <div class="inline-reply-box">
                        <img src="../assets/logos/cindrome-logo.png" alt="My Avatar" class="comment-avatar small-avatar">
                        <div class="modern-input-wrapper">
                            <textarea class="comment-textarea" placeholder="Reply to @${currentUsername}..." rows="1"></textarea>
                            <button class="modern-post-btn" title="Send Reply">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                        <button class="reply-cancel-btn" title="Cancel Reply">Cancel</button>
                    </div>
                </div>
            </div>
            <div class="nested-replies"></div>
        `;

    commentsList.prepend(newCommentThread);
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

  function submitReply(replyBox) {
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

    const newReply = document.createElement("div");
    newReply.className = `single-comment ${isSubReply ? "sub-reply-comment" : "reply-comment"}`;
    newReply.innerHTML = `
            <img src="../assets/logos/cindrome-logo.png" alt="User" class="comment-avatar small-avatar">
            <div class="comment-content-wrapper">
                <div class="comment-header">
                    <span class="comment-user">@${currentUsername}</span>
                    <span class="comment-time">Just now</span>
                </div>
                <p class="comment-text">${mentionPrefix}${escapeHtml(replyText)}</p>
                <div class="comment-interactions">
                    <button class="interaction-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg> 0
                    </button>
                    <button class="interaction-btn reply-trigger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg> Reply
                    </button>
                </div>
                <div class="inline-reply-box">
                    <img src="../assets/logos/cindrome-logo.png" alt="My Avatar" class="comment-avatar small-avatar">
                    <div class="modern-input-wrapper">
                        <textarea class="comment-textarea" placeholder="Reply to @${currentUsername}..." rows="1"></textarea>
                        <button class="modern-post-btn" title="Send Reply">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                    <button class="reply-cancel-btn" title="Cancel Reply">Cancel</button>
                </div>
            </div>
        `;

    targetContainer.appendChild(newReply);
    textarea.value = "";
    delete replyBox.dataset.replyTo;
    replyBox.classList.remove("is-active");
    updateCommentsCount(1);
  }

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

      const sendReplyBtn = e.target.closest(
        ".inline-reply-box .modern-post-btn",
      );
      if (sendReplyBtn) {
        const replyBox = sendReplyBtn.closest(".inline-reply-box");
        if (replyBox) submitReply(replyBox);
        return;
      }

      const likeCommentBtn = e.target.closest(".interaction-btn");
      if (
        likeCommentBtn &&
        !likeCommentBtn.classList.contains("reply-trigger")
      ) {
        const isLiked = likeCommentBtn.classList.toggle("is-liked");
        let currentNum = parseInt(likeCommentBtn.textContent.trim(), 10) || 0;
        currentNum = isLiked ? currentNum + 1 : Math.max(0, currentNum - 1);
        const svgHtml = likeCommentBtn.querySelector("svg").outerHTML;
        likeCommentBtn.innerHTML = `${svgHtml} ${currentNum}`;
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
