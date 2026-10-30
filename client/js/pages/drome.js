document.addEventListener("DOMContentLoaded", () => {
  // DOM element selections
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

  // Chat bubble templates
  const userBubbleTemplate = document.getElementById("userBubbleTemplate");
  const dromeBubbleTemplate = document.getElementById("dromeBubbleTemplate");
  const stopBubbleTemplate = document.getElementById("stopBubbleTemplate");
  const chatMovieCardTemplate = document.getElementById(
    "chatMovieCardTemplate",
  );

  let isGenerating = false;
  let replyTimeout;

  // Auto-resize input textarea based on content
  function autoResize() {
    dromeInput.style.height = "auto";
    dromeInput.style.height = dromeInput.scrollHeight + "px";
  }

  dromeInput.addEventListener("input", autoResize);

  // Send message on Enter key without Shift
  dromeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) {
        handleSend();
      }
    }
  });

  // Toggle send and stop generation
  mainSendBtn.addEventListener("click", () => {
    if (isGenerating) {
      stopGeneration();
    } else {
      handleSend();
    }
  });

  // Suggestion prompt buttons
  promptBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (isGenerating) return;
      const text = this.getAttribute("data-prompt");
      dromeInput.value = text;
      autoResize();
      handleSend();
    });
  });

  // Focus topic dropdown selector
  focusItems.forEach((item) => {
    item.addEventListener("click", function () {
      currentFocusText.textContent = this.textContent;
      contentDropdown.removeAttribute("open");
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

  // Chat engine: message sending and response handling
  function handleSend() {
    const text = dromeInput.value.trim();
    if (text === "" || isGenerating) return;

    dromeInput.blur();
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

    replyTimeout = setTimeout(() => {
      typingIndicator.classList.add("is-hidden");

      const dromeClone = dromeBubbleTemplate.content.cloneNode(true);
      dromeClone.querySelector(".message-text").innerHTML =
        "I found some great options that match your mood perfectly! Check these out:";

      const cardsRow = dromeClone.querySelector(".chat-cards-row");

      function createCard(title, year, rating, posterSrc, link) {
        const cardClone = chatMovieCardTemplate.content.cloneNode(true);
        cardClone.querySelector(".chat-movie-poster").src = posterSrc;
        cardClone.querySelector(".chat-movie-title").textContent = title;
        cardClone.querySelector(".chat-movie-year").textContent = year;
        cardClone.querySelector(".rating-val").textContent = rating;
        cardClone.querySelector(".chat-btn-details").href = link;

        const watchBtn = cardClone.querySelector(".chat-btn-watchlist");
        watchBtn.addEventListener("click", function (e) {
          e.preventDefault();
          this.classList.toggle("added");
          const minusIcon = this.querySelector(".icon-minus");
          const plusIcon = this.querySelector(".icon-plus");
          if (this.classList.contains("added")) {
            minusIcon.style.display = "block";
            plusIcon.style.display = "none";
          } else {
            minusIcon.style.display = "none";
            plusIcon.style.display = "block";
          }
        });
        return cardClone;
      }

      cardsRow.appendChild(
        createCard(
          "Interstellar",
          "2014",
          "8.7",
          "https://media.themoviedb.org/t/p/w440_and_h660_face/nrSaXF39nDfAAeLKksRCyvSzI2a.jpg",
          "/details?id=interstellar",
        ),
      );
      cardsRow.appendChild(
        createCard(
          "Inception",
          "2010",
          "8.8",
          "https://media.themoviedb.org/t/p/w440_and_h660_face/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
          "/details?id=inception",
        ),
      );

      chatInner.insertBefore(dromeClone, typingIndicator);
      chatContainer.scrollTop = chatContainer.scrollHeight;

      finishGeneration();
    }, 3000);
  }

  function stopGeneration() {
    clearTimeout(replyTimeout);
    typingIndicator.classList.add("is-hidden");

    const stopClone = stopBubbleTemplate.content.cloneNode(true);
    chatInner.insertBefore(stopClone, typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    finishGeneration();
  }

  function finishGeneration() {
    isGenerating = false;
    updateInputUI();
  }

  function updateInputUI() {
    if (isGenerating) {
      sendBtnIcon.className = "fa-solid fa-stop";
      dromeInput.readOnly = true;
      dromeInput.placeholder = "Drome is thinking...";
      dromeInput.blur();
    } else {
      sendBtnIcon.className = "fa-solid fa-arrow-up";
      dromeInput.readOnly = false;
      dromeInput.placeholder = "Type a message...";
      dromeInput.blur();
    }
  }

  // Clear conversation
  function clearChat() {
    const bubbles = chatInner.querySelectorAll(
      ".chat-bubble:not(.typing-indicator-bubble)",
    );
    bubbles.forEach((b) => b.remove());

    if (emptyState) emptyState.classList.remove("is-hidden");
    chatContainer.scrollTop = 0;
  }

  newChatBtn.addEventListener("click", clearChat);

  // Pull-to-refresh interaction for mobile devices
  let pStart = 0;
  let pCurrent = 0;
  const ptrIndicator = document.getElementById("pullToRefreshIndicator");

  chatContainer.addEventListener(
    "touchstart",
    function (e) {
      if (chatContainer.scrollTop === 0) {
        pStart = e.touches[0].clientY;
      }
    },
    { passive: true },
  );

  chatContainer.addEventListener(
    "touchmove",
    function (e) {
      if (chatContainer.scrollTop === 0 && pStart > 0) {
        pCurrent = e.touches[0].clientY;
        let pullDistance = pCurrent - pStart;

        if (pullDistance > 0) {
          let height = Math.min(pullDistance * 0.4, 70);
          ptrIndicator.style.height = height + "px";

          if (height >= 50) {
            ptrIndicator.innerHTML =
              '<i class="fa-solid fa-plus"></i> <span>Release for new chat</span>';
          } else {
            ptrIndicator.innerHTML =
              '<i class="fa-solid fa-arrow-down"></i> <span>Pull down</span>';
          }
        }
      }
    },
    { passive: true },
  );

  chatContainer.addEventListener("touchend", function () {
    if (pStart > 0 && pCurrent > 0) {
      let pullDistance = pCurrent - pStart;
      let height = Math.min(pullDistance * 0.4, 70);

      if (height >= 50 && chatContainer.scrollTop === 0) {
        ptrIndicator.innerHTML =
          '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Starting...</span>';
        setTimeout(() => {
          clearChat();
          resetPTR();
        }, 400);
      } else {
        resetPTR();
      }
    }
    pStart = 0;
    pCurrent = 0;
  });

  function resetPTR() {
    ptrIndicator.style.height = "0px";
  }
});
