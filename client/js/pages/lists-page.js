document.addEventListener("DOMContentLoaded", () => {
  // عناصر الـ DOM
  const listsGrid = document.getElementById("listsGrid");
  const loader = document.getElementById("listsLoader");
  const noListsMsg = document.getElementById("noListsMsg");
  const searchInput = document.querySelector(".lists-search-input");
  const listsFilterDropdown = document.getElementById("listsFilterDropdown");
  const paginationContainer = document.getElementById("paginationContainer");
  const listCardTemplate = document.getElementById("listCardTemplate");

  // حالة التطبيق (State)
  let currentSearch = "";
  let currentFilter = "Popular";
  let currentPage = 1;

  // ==========================================
  // 1. جلب البيانات من السيرفر (Fetch)
  // ==========================================
  async function fetchLists() {
    // إظهار اللودر
    if (listsGrid) listsGrid.innerHTML = "";
    if (loader) loader.style.display = "block";
    if (noListsMsg) noListsMsg.style.display = "none";

    try {
      const response = await fetch(
        `/api/lists/explore?search=${encodeURIComponent(currentSearch)}&filter=${currentFilter}&page=${currentPage}`,
      );
      const data = await response.json();
      renderLists(data.lists);
      renderPagination(data.currentPage, data.totalPages);
    } catch (error) {
      console.error("Error fetching lists:", error);
      if (loader) loader.style.display = "none";
    }
  }

  // ==========================================
  // 2. بناء الكروت (Render)
  // ==========================================
  function renderLists(lists) {
    if (loader) loader.style.display = "none";
    if (listsGrid) listsGrid.innerHTML = "";

    if (!lists || lists.length === 0) {
      if (noListsMsg) noListsMsg.style.display = "block";
      return;
    }

    lists.forEach((list) => {
      const clone = listCardTemplate.content.cloneNode(true);
      const card = clone.querySelector(".list-card");

      // البوسترات (لو القائمة فاضية هنحط ديفولت)
      const posters = list.preview_posters || [];
      const posterElements = card.querySelectorAll(".stack-poster");
      posterElements.forEach((img, idx) => {
        if (posters[idx]) {
          img.src = posters[idx].startsWith("http")
            ? posters[i]
            : `https://image.tmdb.org/t/p/w500${posters[idx]}`;
          img.style.opacity = "1";
          img.style.filter = "none";
        } else {
          img.src = "/assets/posters/default-poster.png";
          img.style.opacity = "0.5";
          img.style.filter = "grayscale(100%)";
        }
        img.onerror = function () {
          this.onerror = null;
          this.src = "/assets/posters/default-poster.png";
        };
      });

      // رابط القائمة بالكامل (البوسترات والعنوان)
      const listUrl = `/single-list?id=${list.list_id}`;
      card
        .querySelector(".poster-stack")
        .addEventListener("click", () => (window.location.href = listUrl));

      const titleEl = card.querySelector(".list-title");
      titleEl.textContent = list.title;
      titleEl.href = listUrl;

      // اليوزر
      const authorLink = card.querySelector(".list-author-link");
      authorLink.textContent = `@${list.username}`;
      authorLink.href = `/profile/${list.username}`;

      // العدد
      card.querySelector(".count-num").textContent = list.total_items;

      // اللايكات والكومنتات
      const likeBtn = card.querySelector(".like-btn");
      likeBtn.setAttribute("data-list-id", list.list_id);
      if (list.is_liked_by_user) likeBtn.classList.add("is-liked", "liked"); // 'liked' عشان ה-CSS القديم
      card.querySelector(".like-count").textContent = formatNumber(
        list.likes_count,
      );

      const commentBtn = card.querySelector(".comment-btn");
      commentBtn.href = `${listUrl}#comments-section`;
      card.querySelector(".comment-count").textContent = formatNumber(
        list.comments_count,
      );

      // تفعيل زرار اللايك
      likeBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        e.stopPropagation();

        try {
          const res = await fetch(`/api/lists/${list.list_id}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (res.ok) {
            const data = await res.json();
            const span = this.querySelector(".like-count");
            let count = parseInt(span.textContent.replace(/,/g, "")) || 0;
            if (data.status === "added") {
              this.classList.add("is-liked", "liked");
              span.textContent = formatNumber(count + 1);
            } else {
              this.classList.remove("is-liked", "liked");
              span.textContent = formatNumber(Math.max(0, count - 1));
            }
          } else if (res.status === 401) {
            window.location.href = "/sign-in";
          }
        } catch (err) {
          console.error("Like error:", err);
        }
      });

      listsGrid.appendChild(card);
    });
  }

  // دالة لتنسيق الأرقام الكبيرة (1.2k)
  function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num;
  }

  // ==========================================
  // 3. Pagination
  // ==========================================
  function renderPagination(current, total) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    if (total <= 1) return; // مفيش داعي للزراير لو هي صفحة واحدة

    // زرار Prev
    const prevBtn = document.createElement("button");
    prevBtn.className = `page-btn prev-next ${current === 1 ? "disabled" : ""}`;
    prevBtn.textContent = "PREV";
    prevBtn.disabled = current === 1;
    prevBtn.addEventListener("click", () => {
      if (current > 1) {
        currentPage--;
        fetchLists();
      }
    });
    paginationContainer.appendChild(prevBtn);

    // زراير الأرقام (مبسطة: بنعرض اول 3 واخر صفحة، او نعرضها بطريقة ذكية)
    // للحفاظ على بساطة الـ UI هنعرض شوية زراير
    let startPage = Math.max(1, current - 1);
    let endPage = Math.min(total, current + 1);

    if (current === 1) endPage = Math.min(total, 3);
    if (current === total) startPage = Math.max(1, total - 2);

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement("button");
      btn.className = `page-btn page-num-btn ${i === current ? "active" : ""}`;
      btn.textContent = i;
      btn.addEventListener("click", () => {
        currentPage = i;
        fetchLists();
      });
      paginationContainer.appendChild(btn);
    }

    // زرار Next
    const nextBtn = document.createElement("button");
    nextBtn.className = `page-btn prev-next ${current === total ? "disabled" : ""}`;
    nextBtn.textContent = "NEXT";
    nextBtn.disabled = current === total;
    nextBtn.addEventListener("click", () => {
      if (current < total) {
        currentPage++;
        fetchLists();
      }
    });
    paginationContainer.appendChild(nextBtn);
  }

  // ==========================================
  // 4. الأحداث (Events: Search & Filter)
  // ==========================================

  // البحث
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        fetchLists();
      }, 500); // 500ms debounce
    });
  }

  // الفلتر (Dropdown)
  if (listsFilterDropdown) {
    const labelText = listsFilterDropdown.querySelector(".dropdown-label-text");
    const items = listsFilterDropdown.querySelectorAll(".dropdown-item");

    items.forEach((item) => {
      item.addEventListener("click", function (e) {
        e.stopPropagation();
        const newFilter = this.textContent.trim();

        if (labelText) labelText.textContent = newFilter;
        listsFilterDropdown.removeAttribute("open");

        if (currentFilter !== newFilter) {
          currentFilter = newFilter;
          currentPage = 1;
          fetchLists();
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (
        listsFilterDropdown.hasAttribute("open") &&
        !listsFilterDropdown.contains(e.target)
      ) {
        listsFilterDropdown.removeAttribute("open");
      }
    });
  }

  // التشغيل الأول عند فتح الصفحة
  fetchLists();
});
