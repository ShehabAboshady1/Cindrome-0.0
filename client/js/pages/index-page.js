document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // 🌟 3. تشغيل زراير الـ Like في كروت القوائم 🌟
  // ==================================================
  const listLikeBtns = document.querySelectorAll(".list-action-btn.like-btn");
  listLikeBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      // بيحط كلاس 'is-liked' أو بيشيله
      this.classList.toggle("is-liked");
    });
  });
});
