document.addEventListener("DOMContentLoaded", () => {
  // Unified comments handling for reviews and lists
  const commentsSection = document.getElementById("comments-section");
  const commentsList = document.getElementById("commentsListContainer");
  const mainCommentTextarea = document.querySelector(
    ".add-comment-box .comment-textarea",
  );
  const mainPostBtn = document.querySelector(
    ".add-comment-box .modern-post-btn",
  );
  const commentsCountHeader = document.querySelector(".comments-count");
  const commentTemplate = document.getElementById("commentTemplate");

  let targetId = null;
  let targetType = "review";

  if (commentsSection) {
    targetId = commentsSection.getAttribute("data-target-id");
    targetType = commentsSection.getAttribute("data-target-type") || "review";

    if (!targetId && targetType === "review") {
      targetId = window.location.pathname.split("/").pop();
    }
  }

  function updateCommentsCount(change = 1) {
    if (!commentsCountHeader) return;
    let count = parseInt(commentsCountHeader.textContent, 10) || 0;
    count += change;
    commentsCountHeader.textContent = count;
  }

  function createCommentElement(data, isReply = false) {
    if (!commentTemplate) return null;
    const clone = commentTemplate.content.cloneNode(true);
    const newComment = clone.querySelector(
      isReply ? ".single-comment" : ".comment-thread",
    );

    const targetElement = isReply
      ? newComment
      : newComment.querySelector(".single-comment");

    if (isReply) {
      targetElement.classList.add("sub-reply-comment");
    }

    const userLink = targetElement.querySelector(".comment-user-link");
    const userLinkText = targetElement.querySelector(".comment-user-link-text");
    const avatar = targetElement.querySelector(
      ".comment-avatar:not(.reply-avatar)",
    );

    if (userLink) userLink.href = `/profile/${data.username}`;
    if (userLinkText) {
      userLinkText.href = `/profile/${data.username}`;
      userLinkText.textContent = `@${data.username}`;
    }
    if (avatar) avatar.src = data.avatar_url || "/assets/profile-avatar.jpg";

    targetElement.querySelector(".comment-text").innerHTML = data.content;

    const likeBtn = targetElement.querySelector(".comment-like-btn");
    if (likeBtn) likeBtn.dataset.commentId = data.comment_id;

    return newComment;
  }

  // Submit root comment
  async function postMainComment() {
    if (!mainCommentTextarea || !targetId) return;
    const text = mainCommentTextarea.value.trim();
    if (!text) {
      mainCommentTextarea.focus();
      return;
    }

    const apiUrl =
      targetType === "list"
        ? `/api/lists/${targetId}/comment`
        : `/api/reviews/${targetId}/comment`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (response.ok) {
        const data = await response.json();

        const newThread = createCommentElement(
          {
            username: data.username,
            avatar_url: data.avatar_url,
            content: text,
            comment_id: data.comment_id,
          },
          false,
        );

        if (newThread) {
          const noCommentsMsg = commentsList.querySelector(".no-comments-msg");
          if (noCommentsMsg) noCommentsMsg.remove();

          commentsList.prepend(newThread);
        }

        mainCommentTextarea.value = "";
        updateCommentsCount(1);
      } else if (response.status === 401) {
        window.location.href = "/sign-in";
      }
    } catch (err) {
      console.error("Error posting comment:", err);
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

  // Handle comment interactions: replies and likes
  if (commentsList) {
    commentsList.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const replyTextarea = e.target.closest(
          ".inline-reply-box .comment-textarea",
        );
        if (replyTextarea) {
          e.preventDefault();
          const replyBox = replyTextarea.closest(".inline-reply-box");
          const sendReplyBtn = replyBox.querySelector(".modern-post-btn");
          if (sendReplyBtn) sendReplyBtn.click();
        }
      }
    });

    commentsList.addEventListener("click", async (e) => {
      // Toggle reply box
      const replyBtn = e.target.closest(".reply-trigger");
      if (replyBtn) {
        const parentThread = replyBtn.closest(".comment-thread");
        const replyBox = parentThread.querySelector(".inline-reply-box");

        if (replyBox) {
          document
            .querySelectorAll(".inline-reply-box.is-active")
            .forEach((b) => {
              if (b !== replyBox) b.classList.remove("is-active");
            });

          const currentCommentWrapper = replyBtn.closest(
            ".comment-content-wrapper",
          );
          const interactionsDiv = currentCommentWrapper.querySelector(
            ".comment-interactions",
          );

          if (
            replyBox.previousElementSibling === interactionsDiv &&
            replyBox.classList.contains("is-active")
          ) {
            replyBox.classList.remove("is-active");
            return;
          }

          interactionsDiv.after(replyBox);

          const targetUser =
            currentCommentWrapper
              .querySelector(".comment-user-link-text")
              ?.textContent.trim() ||
            currentCommentWrapper
              .querySelector(".comment-user a")
              ?.textContent.trim() ||
            "";

          replyBox.dataset.replyTo = targetUser;
          replyBox.classList.add("is-active");

          const area = replyBox.querySelector(".comment-textarea");
          if (area) {
            area.placeholder = targetUser
              ? `Reply to ${targetUser}...`
              : `Reply...`;
            area.focus();
          }
        }
        return;
      }

      // Cancel reply
      const cancelBtn = e.target.closest(".reply-cancel-btn");
      if (cancelBtn) {
        const replyBox = cancelBtn.closest(".inline-reply-box");
        if (replyBox) {
          replyBox.classList.remove("is-active");
          const area = replyBox.querySelector(".comment-textarea");
          if (area) area.value = "";
        }
        return;
      }

      // Submit reply
      const sendReplyBtn = e.target.closest(
        ".inline-reply-box .modern-post-btn",
      );
      if (sendReplyBtn) {
        const replyBox = sendReplyBtn.closest(".inline-reply-box");
        const textarea = replyBox.querySelector(".comment-textarea");
        const replyText = textarea.value.trim();

        if (!replyText) {
          textarea.focus();
          return;
        }

        const thread = replyBox.closest(".comment-thread");
        const parentCommentId =
          thread.dataset.commentId ||
          thread.querySelector(".comment-like-btn").dataset.commentId;
        const replyToUser = replyBox.dataset.replyTo || "";

        let plainText = replyText;
        if (replyToUser && !replyText.startsWith(replyToUser)) {
          plainText = `${replyToUser} ${replyText}`;
        }

        let htmlContent = replyText;
        if (replyToUser && !replyText.startsWith(replyToUser)) {
          htmlContent = `<span class="comment-mention">${replyToUser}</span> ${replyText}`;
        }

        const apiUrl =
          targetType === "list"
            ? `/api/lists/${targetId}/comment`
            : `/api/reviews/${targetId}/comment`;

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: plainText,
              parent_comment_id: parentCommentId,
            }),
          });

          if (response.ok) {
            const data = await response.json();

            let nestedContainer = thread.querySelector(".nested-replies");
            if (!nestedContainer) {
              nestedContainer = document.createElement("div");
              nestedContainer.className = "nested-replies";
              thread.appendChild(nestedContainer);
            }

            const newReply = createCommentElement(
              {
                username: data.username,
                avatar_url: data.avatar_url,
                content: htmlContent,
                comment_id: data.comment_id,
              },
              true,
            );

            if (newReply) {
              nestedContainer.appendChild(newReply);
            }

            textarea.value = "";
            replyBox.classList.remove("is-active");
            updateCommentsCount(1);
          } else if (response.status === 401) {
            window.location.href = "/sign-in";
          }
        } catch (err) {
          console.error("Error posting reply:", err);
        }
        return;
      }

      // Toggle comment like
      const likeCommentBtn = e.target.closest(".comment-like-btn");
      if (likeCommentBtn) {
        const commentId = likeCommentBtn.dataset.commentId;
        if (!commentId) return;

        const apiUrl =
          targetType === "list"
            ? `/api/list-comments/${commentId}/like`
            : `/api/comments/${commentId}/like`;

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (response.ok) {
            const data = await response.json();
            const span = likeCommentBtn.querySelector("span");
            let currentNum = parseInt(span.textContent.trim(), 10) || 0;

            if (data.status === "added") {
              likeCommentBtn.classList.add("is-liked");
              span.textContent = currentNum + 1;
            } else if (data.status === "removed") {
              likeCommentBtn.classList.remove("is-liked");
              span.textContent = Math.max(0, currentNum - 1);
            }
          } else if (response.status === 401) {
            window.location.href = "/sign-in";
          }
        } catch (err) {
          console.error("Error toggling comment like:", err);
        }
      }
    });
  }
});
