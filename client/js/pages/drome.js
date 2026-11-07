// public/js/pages/drome.js

document.addEventListener("DOMContentLoaded", () => {
  const dromeInput = document.getElementById("dromeInput");
  const dromeInputBox = document.getElementById("dromeInputBox");
  const mainSendBtn = document.getElementById("mainSendBtn");
  const sendBtnIcon = document.getElementById("sendBtnIcon");
  const newChatBtn = document.getElementById("newChatBtn");
  const authBanner = document.getElementById("dromeAuthBanner");

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

  // 🌟 استخراج حالة تسجيل الدخول الصريحة من EJS
  const isAuthenticated = Boolean(window.IS_AUTHENTICATED);
  const currentUserId = window.CURRENT_USER_ID || null;

  const storageKey =
    isAuthenticated && currentUserId ? `cindrome_chat_${currentUserId}` : null;

  let isGenerating = false;
  let abortController = null;
  let chatHistory = [];

  // ==========================================
  // 🔒 فحص أمان الواجهة وحظر الزوار (UI Guard)
  // ==========================================
  function enforceAuthGuard() {
    if (!isAuthenticated) {
      if (authBanner) authBanner.classList.remove("is-hidden");
      if (dromeInputBox) dromeInputBox.classList.add("disabled");
      if (dromeInput) {
        dromeInput.disabled = true;
        dromeInput.placeholder =
          "Please sign in to start chatting with Cindrome...";
      }
      if (mainSendBtn) mainSendBtn.disabled = true;
      promptBtns.forEach((btn) => (btn.disabled = true));
      return false;
    } else {
      if (authBanner) authBanner.classList.add("is-hidden");
      if (dromeInputBox) dromeInputBox.classList.remove("disabled");
      if (dromeInput) {
        dromeInput.disabled = false;
        dromeInput.placeholder = "Type a message...";
      }
      if (mainSendBtn) mainSendBtn.disabled = false;
      promptBtns.forEach((btn) => (btn.disabled = false));
      return true;
    }
  }

  // ==========================================
  // 1. دوال إدارة الحفظ في localStorage
  // ==========================================
  function saveHistory() {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    } catch (e) {
      console.warn("LocalStorage write failed:", e);
    }
  }

  function loadHistory() {
    if (!storageKey) {
      clearChatUIOnly();
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
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

        setTimeout(() => {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
      }
    } catch (err) {
      console.error("Error restoring chat history:", err);
      localStorage.removeItem(storageKey);
      chatHistory = [];
    }
  }

  function clearChatUIOnly() {
    chatHistory = [];
    if (chatInner) {
      const bubbles = chatInner.querySelectorAll(
        ".chat-bubble:not(.typing-indicator-bubble)",
      );
      bubbles.forEach((b) => b.remove());
    }
    if (emptyState) emptyState.classList.remove("is-hidden");
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

    watchBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      if (!isAuthenticated) {
        window.location.href = "/sign-in";
        return;
      }
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
          item.inWatchlist = isAdded;
          saveHistory();

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

  if (dromeInput) {
    dromeInput.addEventListener("input", autoResize);

    dromeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!isGenerating) {
          handleSend();
        }
      }
    });
  }

  if (mainSendBtn) {
    mainSendBtn.addEventListener("click", () => {
      if (isGenerating) {
        stopGeneration();
      } else {
        handleSend();
      }
    });
  }

  promptBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (!enforceAuthGuard()) return;
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
      if (isAuthenticated && dromeInput) dromeInput.focus();
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
    if (!enforceAuthGuard()) return;

    const text = dromeInput.value.trim();
    if (text === "" || isGenerating) return;

    const focusType = currentFocusText.textContent.trim().toLowerCase();

    isGenerating = true;
    updateInputUI();

    if (emptyState) emptyState.classList.add("is-hidden");

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

      if (response.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Network error");

      typingIndicator.classList.add("is-hidden");

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
      if (isAuthenticated && dromeInput) dromeInput.focus();
    }, 50);
  }

  function updateInputUI() {
    if (!isAuthenticated) return;
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
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    clearChatUIOnly();
    chatContainer.scrollTop = 0;
    if (isAuthenticated && dromeInput) dromeInput.focus();
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", clearChat);
  }

  // ==========================================
  // 6. تصفير الشات عند تسجيل الخروج (Logout Hooks)
  // ==========================================
  const logoutLinks = document.querySelectorAll(
    'a[href="/logout"], a[href="/sign-out"], .logout-btn',
  );
  logoutLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("cindrome_chat_")) {
          localStorage.removeItem(key);
        }
      });
    });
  });

  // تشغيل الفحص المبدئي واستعادة التاريخ
  enforceAuthGuard();
  loadHistory();
});
