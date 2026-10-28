document.addEventListener("DOMContentLoaded", () => {
  // 1. كشف السبويلر
  const reviewWrapper = document.getElementById("reviewTextWrapper");
  const spoilerBadge = document.getElementById("spoilerBadge");

  function revealSpoiler() {
    if (reviewWrapper && reviewWrapper.classList.contains("is-spoiler")) {
      reviewWrapper.classList.remove("is-spoiler");
      reviewWrapper.classList.add("revealed");
      reviewWrapper.removeAttribute("title");
      if (spoilerBadge) spoilerBadge.style.display = "none";
    }
  }

  if (reviewWrapper) reviewWrapper.addEventListener("click", revealSpoiler);
  if (spoilerBadge) spoilerBadge.addEventListener("click", revealSpoiler);

  // 2. أزرار المراجعة (لايك وشير)
  const reviewLikeBtn = document.getElementById("reviewLikeBtn");
  const reviewShareBtn = document.getElementById("reviewShareBtn");

  if (reviewLikeBtn) {
    reviewLikeBtn.addEventListener("click", async () => {
      const reviewId = window.location.pathname.split("/").pop();
      try {
        const response = await fetch(`/api/reviews/${reviewId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          const span = reviewLikeBtn.querySelector("span");
          let count = parseInt(span.textContent) || 0;

          if (data.status === "added") {
            reviewLikeBtn.classList.add("is-liked");
            span.textContent = count + 1;
          } else if (data.status === "removed") {
            reviewLikeBtn.classList.remove("is-liked");
            span.textContent = Math.max(0, count - 1);
          }
        } else if (response.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (error) {
        console.error("Error toggling like:", error);
      }
    });
  }

  if (reviewShareBtn) {
    reviewShareBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        reviewShareBtn.classList.add("is-copied");
        reviewShareBtn.setAttribute("title", "Copied!");
        setTimeout(() => {
          reviewShareBtn.classList.remove("is-copied");
          reviewShareBtn.setAttribute("title", "Copy link");
        }, 800);
      } catch (err) {
        // Fallback for older browsers
        const dummy = document.createElement("input");
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);

        reviewShareBtn.classList.add("is-copied");
        setTimeout(() => reviewShareBtn.classList.remove("is-copied"), 800);
      }
    });
  }

  // 3. التعليقات والردود
  const commentsList = document.querySelector(".comments-list");
  const mainCommentTextarea = document.querySelector(
    ".add-comment-box .comment-textarea",
  );
  const mainPostBtn = document.querySelector(
    ".add-comment-box .modern-post-btn",
  );
  const commentsCountHeader = document.querySelector(".comments-count");

  function updateCommentsCount(change = 1) {
    if (!commentsCountHeader) return;
    let count = parseInt(commentsCountHeader.textContent, 10) || 0;
    count += change;
    commentsCountHeader.textContent = count;
  }

  // دالة مساعدة لنسخ الـ Template وتعبئة البيانات (تستخدم للتعليقات والردود)
  function createCommentElement(
    data,
    text,
    isSubReply = false,
    replyToUser = "",
  ) {
    const template = document.getElementById("commentTemplate");
    if (!template) return null;

    const newCommentThread = template.content.cloneNode(true).firstElementChild;
    newCommentThread.dataset.commentId = data.comment_id;

    const singleCommentDiv = newCommentThread.querySelector(".single-comment");

    // لو ده رد (Reply)، نغير شكله ونصغّره
    if (isSubReply) {
      singleCommentDiv.className = "single-comment sub-reply-comment";
      const mainAvatar = newCommentThread.querySelector(".comment-avatar");
      mainAvatar.classList.add("small-avatar");

      // نشيل زرار صندوق الرد للردود المتداخلة (ممكن اليوزر يعمل Reply ويفتح صندوق الأب)
      const inlineReplyBox =
        newCommentThread.querySelector(".inline-reply-box");
      if (inlineReplyBox) inlineReplyBox.remove();
    }

    // ربط الصورة بالبروفايل ديناميكياً
    const userLink = newCommentThread.querySelector(".comment-user-link");
    if (userLink) userLink.href = `/profile/${data.username}`;

    const avatarImg = newCommentThread.querySelector(".comment-avatar");
    avatarImg.src = data.avatar_url || "/assets/profile-avatar.jpg";

    // ربط الاسم بالبروفايل ديناميكياً
    const userSpanText = newCommentThread.querySelector(
      ".comment-user-link-text",
    );
    if (userSpanText) {
      userSpanText.href = `/profile/${data.username}`;
      userSpanText.textContent = `@${data.username}`;
    }

    const textP = newCommentThread.querySelector(".comment-text");

    // إضافة الـ Mention كنص محمي عشان الـ JS يرسمه وقتي
    if (replyToUser) {
      textP.innerHTML = `<span class="comment-mention">${replyToUser}</span> ${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
    } else {
      textP.innerHTML = text
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /\B@\w+/g,
          (match) => `<span class="comment-mention">${match}</span>`,
        );
    }

    // إعداد صندوق الرد الداخلي (لو موجود)
    const replyAvatar = newCommentThread.querySelector(".reply-avatar");
    if (replyAvatar)
      replyAvatar.src = data.avatar_url || "/assets/profile-avatar.jpg";

    const replyTextarea = newCommentThread.querySelector(".comment-textarea");
    if (replyTextarea)
      replyTextarea.placeholder = `Reply to @${data.username}...`;

    // تحديث ID زرار اللايك
    const likeBtn = newCommentThread.querySelector(".comment-like-btn");
    if (likeBtn) likeBtn.dataset.commentId = data.comment_id;

    return newCommentThread;
  }

  // إضافة تعليق أساسي
  async function postMainComment() {
    if (!mainCommentTextarea) return;
    const text = mainCommentTextarea.value.trim();
    if (!text) {
      mainCommentTextarea.focus();
      return;
    }

    const reviewId = window.location.pathname.split("/").pop();

    try {
      const response = await fetch(`/api/reviews/${reviewId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (response.ok) {
        const data = await response.json();
        const noCommentsMsg = commentsList.querySelector(".no-comments-msg");
        if (noCommentsMsg) noCommentsMsg.remove();

        const newElement = createCommentElement(data, text);
        if (newElement) {
          commentsList.prepend(newElement);
        }

        mainCommentTextarea.value = "";
        updateCommentsCount(1);
      } else if (response.status === 401) {
        window.location.href = "/sign-in";
      }
    } catch (error) {
      console.error("Error posting comment:", error);
    }
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

  // إضافة رد متداخل
  async function submitReply(replyBox) {
    const textarea = replyBox.querySelector(".comment-textarea");
    const replyText = textarea.value.trim();
    if (!replyText) {
      textarea.focus();
      return;
    }

    const reviewId = window.location.pathname.split("/").pop();
    const parentThread = replyBox.closest(".comment-thread");
    const parentCommentId = parentThread
      ? parentThread.dataset.commentId
      : null;

    // تجهيز النص وإضافة المنشن لو موجود عشان يتحفظ في الداتابيز صح
    const replyTo = replyBox.dataset.replyTo;
    let finalContent = replyText;
    if (replyTo) {
      finalContent = `${replyTo} ${replyText}`;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: finalContent,
          parent_comment_id: parentCommentId, // بنربط الرد بالأب
        }),
      });

      if (response.ok) {
        const data = await response.json();

        let targetContainer = parentThread.querySelector(".nested-replies");

        const newReplyThread = createCommentElement(
          data,
          replyText,
          true,
          replyTo,
        );

        if (newReplyThread) {
          // ناخد التعليق بس من غير الثريد الأب ونرميه في الـ nested-replies
          const commentOnly = newReplyThread.querySelector(".single-comment");
          targetContainer.appendChild(commentOnly);
        }

        textarea.value = "";
        delete replyBox.dataset.replyTo;
        replyBox.classList.remove("is-active");
        updateCommentsCount(1);
      } else if (response.status === 401) {
        window.location.href = "/sign-in";
      }
    } catch (err) {
      console.error("Error posting reply:", err);
    }
  }

  // التعامل مع أحداث الكومنتات والردود واللايكات
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
      // إظهار/إخفاء صندوق الرد
      const replyBtn = e.target.closest(".reply-trigger");
      if (replyBtn) {
        // نحدد الـ Thread الأساسي عشان نظهر الصندوق بتاعه
        const parentThread = replyBtn.closest(".comment-thread");
        const replyBox = parentThread.querySelector(".inline-reply-box");

        if (replyBox) {
          // نقفل أي صندوق مفتوح تاني
          document
            .querySelectorAll(".inline-reply-box.is-active")
            .forEach((b) => {
              if (b !== replyBox) b.classList.remove("is-active");
            });

          const isNestedComment = !!replyBtn.closest(".sub-reply-comment");

          // نجيب اسم اليوزر اللي دايسين عليه Reply
          const commentWrapper = replyBtn.closest(".comment-content-wrapper");
          const targetUser =
            commentWrapper.querySelector(".comment-user")?.textContent.trim() ||
            "";

          // لو بنرد على رد (مش التعليق الأساسي)، نسجل اسم اليوزر
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

      // إرسال الرد بالزرار
      const sendReplyBtn = e.target.closest(
        ".inline-reply-box .modern-post-btn",
      );
      if (sendReplyBtn) {
        const replyBox = sendReplyBtn.closest(".inline-reply-box");
        if (replyBox) submitReply(replyBox);
        return;
      }

      // 🌟 لايكات التعليقات 🌟
      const likeCommentBtn = e.target.closest(".comment-like-btn");
      if (likeCommentBtn) {
        const commentId = likeCommentBtn.dataset.commentId;

        if (commentId) {
          fetch(`/api/comments/${commentId}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
            .then((response) => {
              if (response.ok) return response.json();
              if (response.status === 401) {
                window.location.href = "/sign-in";
                throw new Error("Unauthorized");
              }
            })
            .then((data) => {
              if (data) {
                const span = likeCommentBtn.querySelector("span");
                let currentNum = parseInt(span.textContent) || 0;
                if (data.status === "added") {
                  likeCommentBtn.classList.add("is-liked");
                  span.textContent = currentNum + 1;
                } else if (data.status === "removed") {
                  likeCommentBtn.classList.remove("is-liked");
                  span.textContent = Math.max(0, currentNum - 1);
                }
              }
            })
            .catch((err) => console.error("Error liking comment:", err));
        }
      }
    });
  }
});
