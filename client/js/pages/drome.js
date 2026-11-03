// public/js/pages/drome.js

document.addEventListener("DOMContentLoaded", () => {
  const dromeInput = document.getElementById("dromeInput");
  const mainSendBtn = document.getElementById("mainSendBtn");
  const sendBtnIcon = document.getElementById("sendBtnIcon");
  const newChatBtn = document.getElementById("newChatBtn");

  const chatContainer = document.getElementById("chatContainer");
  const chatInner = document.getElementById("chatInner");
  const emptyState = document.getElementById("emptyState");
  const typingIndicator = document.getElementById("typingIndicator");

  const promptBtns = document.querySelectorAll(".prompt-btn");
  const focusItems = document.querySelectorAll(
    "#dromeFocusList .dropdown-item",
  );
  const currentFocusText = document.getElementById("currentFocusText");
  const contentDropdown = document.getElementById("contentDropdown");

  const userBubbleTemplate = document.getElementById("userBubbleTemplate");
  const dromeBubbleTemplate = document.getElementById("dromeBubbleTemplate");
  const stopBubbleTemplate = document.getElementById("stopBubbleTemplate");
  const chatMovieCardTemplate = document.getElementById(
    "chatMovieCardTemplate",
  );

  let isGenerating = false;
  let abortController = null;

  function autoResize() {
    dromeInput.style.height = "auto";
    dromeInput.style.height = dromeInput.scrollHeight + "px";
  }

  dromeInput.addEventListener("input", autoResize);

  dromeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) {
        handleSend();
      }
    }
  });

  mainSendBtn.addEventListener("click", () => {
    if (isGenerating) {
      stopGeneration();
    } else {
      handleSend();
    }
  });

  promptBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (isGenerating) return;
      dromeInput.value = this.getAttribute("data-prompt");
      autoResize();
      handleSend();
    });
  });

  focusItems.forEach((item) => {
    item.addEventListener("click", function () {
      currentFocusText.textContent = this.textContent;
      contentDropdown.removeAttribute("open");
      dromeInput.focus();
    });
  });

  document.addEventListener("click", function (event) {
    if (
      contentDropdown &&
      contentDropdown.hasAttribute("open") &&
      !contentDropdown.contains(event.target)
    ) {
      contentDropdown.removeAttribute("open");
    }
  });

  async function handleSend() {
    const text = dromeInput.value.trim();
    if (text === "" || isGenerating) return;

    const focusType = currentFocusText.textContent.trim().toLowerCase();

    isGenerating = true;
    updateInputUI();

    if (emptyState) emptyState.classList.add("is-hidden");

    const userClone = userBubbleTemplate.content.cloneNode(true);
    userClone.querySelector(".message-text").textContent = text;
    chatInner.insertBefore(userClone, typingIndicator);

    dromeInput.value = "";
    dromeInput.style.height = "auto";

    typingIndicator.classList.remove("is-hidden");
    chatContainer.scrollTop = chatContainer.scrollHeight;

    abortController = new AbortController();

    try {
      const response = await fetch("/api/drome/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, focusType: focusType }),
        signal: abortController.signal,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Network error");

      typingIndicator.classList.add("is-hidden");

      const dromeClone = dromeBubbleTemplate.content.cloneNode(true);
      dromeClone.querySelector(".message-text").textContent = data.message;

      const cardsRow = dromeClone.querySelector(".chat-cards-row");

      function createCard(item) {
        const cardClone = chatMovieCardTemplate.content.cloneNode(true);
        cardClone.querySelector(".chat-movie-poster").src =
          item.poster || "/assets/posters/default-poster.png";
        cardClone.querySelector(".chat-movie-title").textContent = item.title;
        cardClone.querySelector(".chat-movie-year").textContent =
          item.meta || item.year || "";
        cardClone.querySelector(".rating-val").textContent = item.score || "NR";
        cardClone.querySelector(".chat-btn-details").href =
          `/details?id=${item.id}&type=${item.mediaType}`;

        const watchBtn = cardClone.querySelector(".chat-btn-watchlist");
        watchBtn.addEventListener("click", function (e) {
          e.preventDefault();
          this.classList.toggle("added");
          const minusIcon = this.querySelector(".icon-minus");
          const plusIcon = this.querySelector(".icon-plus");
          if (this.classList.contains("added")) {
            minusIcon.style.display = "inline-block";
            plusIcon.style.display = "none";
          } else {
            minusIcon.style.display = "none";
            plusIcon.style.display = "inline-block";
          }
        });
        return cardClone;
      }

      if (data.results && data.results.length > 0) {
        data.results.forEach((item) => {
          cardsRow.appendChild(createCard(item));
        });
      }

      chatInner.insertBefore(dromeClone, typingIndicator);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Drome Error:", error);
        typingIndicator.classList.add("is-hidden");
        const dromeClone = dromeBubbleTemplate.content.cloneNode(true);
        dromeClone.querySelector(".message-text").textContent =
          "Sorry, I ran into a technical issue. Please try again.";
        chatInner.insertBefore(dromeClone, typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } finally {
      finishGeneration();
    }
  }

  function stopGeneration() {
    if (abortController) abortController.abort();
    typingIndicator.classList.add("is-hidden");
    const stopClone = stopBubbleTemplate.content.cloneNode(true);
    chatInner.insertBefore(stopClone, typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    finishGeneration();
  }

  function finishGeneration() {
    isGenerating = false;
    updateInputUI();
    // 🌟 إعادة الفوكس تلقائياً لمربع النص بعد الانتهاء
    setTimeout(() => {
      dromeInput.focus();
    }, 50);
  }

  function updateInputUI() {
    if (isGenerating) {
      sendBtnIcon.className = "fa-solid fa-stop";
      dromeInput.readOnly = true;
      dromeInput.placeholder = "Drome is thinking...";
    } else {
      sendBtnIcon.className = "fa-solid fa-arrow-up";
      dromeInput.readOnly = false;
      dromeInput.placeholder = "Type a message...";
    }
  }

  function clearChat() {
    const bubbles = chatInner.querySelectorAll(
      ".chat-bubble:not(.typing-indicator-bubble)",
    );
    bubbles.forEach((b) => b.remove());
    if (emptyState) emptyState.classList.remove("is-hidden");
    chatContainer.scrollTop = 0;
    dromeInput.focus();
  }

  newChatBtn.addEventListener("click", clearChat);
});
