// Carousel slider navigation logic
document.addEventListener("DOMContentLoaded", () => {
  const carousels = document.querySelectorAll(
    ".carousel-section, .lists-section",
  );

  carousels.forEach((carousel) => {
    const track = carousel.querySelector(".carousel-track, .lists-track");
    const prevBtn = carousel.querySelector(
      '.carousel-btn[aria-label="Previous"]',
    );
    const nextBtn = carousel.querySelector('.carousel-btn[aria-label="Next"]');

    if (track && prevBtn && nextBtn) {
      nextBtn.addEventListener("click", () => {
        const scrollAmount = track.clientWidth * 0.8;
        track.scrollBy({ left: scrollAmount, behavior: "smooth" });
      });

      prevBtn.addEventListener("click", () => {
        const scrollAmount = track.clientWidth * 0.8;
        track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      });
    }
  });
});
