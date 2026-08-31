// ==========================================
// CINDROME - CAROUSEL SLIDER LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 🌟 التعديل هنا: ضفنا .lists-section عشان يمسك سلايدر القوائم كمان 🌟
    const carousels = document.querySelectorAll('.carousel-section, .lists-section');

    carousels.forEach(carousel => {
        // بنمسك التراك اللي بيتحرك سواء كان كروت عادية أو قوائم
        const track = carousel.querySelector('.carousel-track, .lists-track');
        // بنمسك زراير اليمين والشمال
        const prevBtn = carousel.querySelector('.carousel-btn[aria-label="Previous"]');
        const nextBtn = carousel.querySelector('.carousel-btn[aria-label="Next"]');

        if (track && prevBtn && nextBtn) {
            
            // لما ندوس يمين (Next)
            nextBtn.addEventListener('click', () => {
                const scrollAmount = track.clientWidth * 0.8;
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });

            // لما ندوس شمال (Previous)
            prevBtn.addEventListener('click', () => {
                const scrollAmount = track.clientWidth * 0.8;
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
        }
    });
});