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
});
