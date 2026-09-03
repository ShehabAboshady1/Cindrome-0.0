document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 🌟 1. تفاعل زرار الإعجاب (Like Button) لكروت القوائم
  // ==========================================
  const listLikeBtns = document.querySelectorAll(".list-action-btn.like-btn");
  listLikeBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("liked");
    });
  });

  // ==========================================
  // 🌟 2. تشغيل الـ Dropdown في شريط فلاتر القوائم
  // ==========================================
  const listsFilterDropdown = document.getElementById("listsFilterDropdown");
  if (listsFilterDropdown) {
    const labelText = listsFilterDropdown.querySelector(".dropdown-label-text");
    const items = listsFilterDropdown.querySelectorAll(".dropdown-item");

    items.forEach((item) => {
      item.addEventListener("click", function (e) {
        e.stopPropagation();
        if (labelText) {
          labelText.textContent = this.textContent.trim();
        }
        listsFilterDropdown.removeAttribute("open");
      });
    });

    document.addEventListener("click", function (e) {
      if (
        listsFilterDropdown.hasAttribute("open") &&
        !listsFilterDropdown.contains(e.target)
      ) {
        listsFilterDropdown.removeAttribute("open");
      }
    });
  }

  // ==========================================
  // 🌟 3. تشغيل شريط التنقل بين الصفحات (Pagination)
  // ==========================================
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageNumBtns = Array.from(document.querySelectorAll(".page-num-btn"));
  const listsContainer = document.querySelector(".lists-container-box");

  function updatePaginationControls() {
    const activeBtn = document.querySelector(".page-num-btn.active");
    const currentIndex = pageNumBtns.indexOf(activeBtn);

    if (prevBtn) {
      if (currentIndex === 0) {
        prevBtn.disabled = true;
        prevBtn.classList.add("disabled");
      } else {
        prevBtn.disabled = false;
        prevBtn.classList.remove("disabled");
      }
    }

    if (nextBtn) {
      if (currentIndex === pageNumBtns.length - 1) {
        nextBtn.disabled = true;
        nextBtn.classList.add("disabled");
      } else {
        nextBtn.disabled = false;
        nextBtn.classList.remove("disabled");
      }
    }
  }

  pageNumBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      pageNumBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      updatePaginationControls();

      if (listsContainer) {
        listsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      const activeBtn = document.querySelector(".page-num-btn.active");
      const currentIndex = pageNumBtns.indexOf(activeBtn);
      if (currentIndex > 0) {
        pageNumBtns[currentIndex - 1].click();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      const activeBtn = document.querySelector(".page-num-btn.active");
      const currentIndex = pageNumBtns.indexOf(activeBtn);
      if (currentIndex < pageNumBtns.length - 1) {
        pageNumBtns[currentIndex + 1].click();
      }
    });
  }

  updatePaginationControls();
});