document.addEventListener("DOMContentLoaded", () => {
  // Toggle like state on community list cards
  const listLikeBtns = document.querySelectorAll(".list-action-btn.like-btn");
  listLikeBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("is-liked");
    });
  });
});
