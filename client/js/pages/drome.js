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
  let chatHistory = [];

  // ==========================================
  // 1. دوال إدارة الحفظ في sessionStorage
  // ==========================================
  function saveHistory() {
    try {
      sessionStorage.setItem("drome_chat_history", JSON.stringify(chatHistory));
    } catch (e) {
      console.warn("SessionStorage write failed:", e);
    }
  }

  function loadHistory() {
    try {
      const stored = sessionStorage.getItem("drome_chat_history");
      if (!stored) return;

      chatHistory = JSON.parse(stored) || [];
      if (chatHistory.length > 0) {
        if (emptyState) emptyState.classList.add("is-hidden");

        chatHistory.forEach((msg) => {
          if (msg.role === "user") {
            appendUserBubble(msg.text);
          } else if (msg.role === "drome") {
            appendDromeBubble(msg.message, msg.results || []);
          } else if (msg.role === "stopped") {
            appendStopBubble();
          }
        });

        // التمرير التلقائي لآخر رسالة بعد إعادة البناء
        setTimeout(() => {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
      }
    } catch (err) {
      console.error("Error restoring chat history:", err);
      sessionStorage.removeItem("drome_chat_history");
      chatHistory = [];
    }
  }

  // ==========================================
  // 2. دوال رسم الفقرات والكروت في الـ DOM
  // ==========================================
  function appendUserBubble(text) {
    const userClone = userBubbleTemplate.content.cloneNode(true);
    userClone.querySelector(".message-text").textContent = text;
    chatInner.insertBefore(userClone, typingIndicator);
  }

  function appendDromeBubble(message, results = []) {
    const dromeClone = dromeBubbleTemplate.content.cloneNode(true);
    dromeClone.querySelector(".message-text").textContent = message;

    const cardsRow = dromeClone.querySelector(".chat-cards-row");
    if (results && results.length > 0) {
      results.forEach((item) => {
        cardsRow.appendChild(createCard(item));
      });
    }

    chatInner.insertBefore(dromeClone, typingIndicator);
  }

  function appendStopBubble() {
    const stopClone = stopBubbleTemplate.content.cloneNode(true);
    chatInner.insertBefore(stopClone, typingIndicator);
  }

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
    const minusIcon = watchBtn.querySelector(".icon-minus");
    const plusIcon = watchBtn.querySelector(".icon-plus");

    // ضبط الحالة المبدئية للزرار (سواء كان قادماً من السيرفر أو مسترجعاً من الـ Session)
    if (item.inWatchlist) {
      watchBtn.classList.add("added");
      watchBtn.title = "Remove from Watchlist";
      minusIcon.style.display = "inline-block";
      plusIcon.style.display = "none";
    } else {
      watchBtn.classList.remove("added");
      watchBtn.title = "Add to Watchlist";
      minusIcon.style.display = "none";
      plusIcon.style.display = "inline-block";
    }

    // ربط الزرار بمسار الـ API الفعلي
    watchBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      if (this.disabled) return;
      this.disabled = true;

      try {
        const res = await fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: item.id,
            media_type: item.mediaType,
          }),
        });

        if (res.status === 401 || res.redirected) {
          window.location.href = "/sign-in";
          return;
        }

        const resData = await res.json();
        if (res.ok) {
          const isAdded = resData.status === "added";
          item.inWatchlist = isAdded; // تحديث الحالة محلياً
          saveHistory(); // تحديث الـ sessionStorage حتى يحتفظ الزرار بحالته الجديدة لو حدث Refresh

          this.classList.toggle("added", isAdded);
          if (isAdded) {
            minusIcon.style.display = "inline-block";
            plusIcon.style.display = "none";
            this.title = "Remove from Watchlist";
          } else {
            minusIcon.style.display = "none";
            plusIcon.style.display = "inline-block";
            this.title = "Add to Watchlist";
          }
        } else {
          alert(resData.error || "Failed to update watchlist");
        }
      } catch (err) {
        console.error("Watchlist toggle error:", err);
      } finally {
        this.disabled = false;
      }
    });

    return cardClone;
  }

  // ==========================================
  // 3. معالجة الإدخال والتنقل
  // ==========================================
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

  // ==========================================
  // 4. إرسال واستقبال الرسائل
  // ==========================================
  async function handleSend() {
    const text = dromeInput.value.trim();
    if (text === "" || isGenerating) return;

    const focusType = currentFocusText.textContent.trim().toLowerCase();

    isGenerating = true;
    updateInputUI();

    if (emptyState) emptyState.classList.add("is-hidden");

    // رسم فقرة المستخدم وحفظها في التاريخ
    appendUserBubble(text);
    chatHistory.push({ role: "user", text });
    saveHistory();

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

      // رسم رد Drome والكروت وحفظها في التاريخ
      appendDromeBubble(data.message, data.results || []);
      chatHistory.push({
        role: "drome",
        message: data.message,
        results: data.results || [],
      });
      saveHistory();

      chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Drome Error:", error);
        typingIndicator.classList.add("is-hidden");

        const errorMsg =
          "Sorry, I ran into a technical issue. Please try again.";
        appendDromeBubble(errorMsg, []);
        chatHistory.push({ role: "drome", message: errorMsg, results: [] });
        saveHistory();

        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } finally {
      finishGeneration();
    }
  }

  function stopGeneration() {
    if (abortController) abortController.abort();
    typingIndicator.classList.add("is-hidden");

    appendStopBubble();
    chatHistory.push({ role: "stopped" });
    saveHistory();

    chatContainer.scrollTop = chatContainer.scrollHeight;
    finishGeneration();
  }

  function finishGeneration() {
    isGenerating = false;
    updateInputUI();
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

  // ==========================================
  // 5. مسح الشات (New Chat)
  // ==========================================
  function clearChat() {
    chatHistory = [];
    sessionStorage.removeItem("drome_chat_history");

    const bubbles = chatInner.querySelectorAll(
      ".chat-bubble:not(.typing-indicator-bubble)",
    );
    bubbles.forEach((b) => b.remove());

    if (emptyState) emptyState.classList.remove("is-hidden");
    chatContainer.scrollTop = 0;
    dromeInput.focus();
  }

  newChatBtn.addEventListener("click", clearChat);

  // تشغيل استعادة التاريخ عند تحميل الصفحة
  loadHistory();
});
