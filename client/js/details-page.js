document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🌟 1. تفاعل زرار الـ Watchlist في الهيرو
    // ==========================================
    const watchlistBtn = document.querySelector('.watchlist-btn');
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', function() {
            this.classList.toggle('added');
            const icon = this.querySelector('i');
            const text = this.querySelector('.btn-text');

            if (this.classList.contains('added')) {
                // تحويل الأيقونة لمصمتة (Filled)
                icon.classList.replace('fa-regular', 'fa-solid'); 
                text.textContent = 'Added';
            } else {
                // تحويل الأيقونة لمفرغة تاني
                icon.classList.replace('fa-solid', 'fa-regular'); 
                text.textContent = 'Watchlist';
            }
        });
    }

    // ==========================================
    // 🌟 2. تفاعل زرار الـ Like في الهيرو
    // ==========================================
    const likeHeroBtn = document.querySelector('.like-btn-hero');
    if (likeHeroBtn) {
        likeHeroBtn.addEventListener('click', function() {
            this.classList.toggle('liked');
            const icon = this.querySelector('i');
            
            if (this.classList.contains('liked')) {
                // تحويل القلب لمصمت
                icon.classList.replace('fa-regular', 'fa-solid');
            } else {
                // تحويل القلب لمفرغ
                icon.classList.replace('fa-solid', 'fa-regular');
            }
        });
    }

    // ==========================================
    // 🌟 3. تبديل المواسم (Season Tabs)
    // ==========================================
    const seasonBtns = document.querySelectorAll('.season-btn');
    const seasonContents = document.querySelectorAll('.season-content');

    seasonBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            seasonBtns.forEach(b => b.classList.remove('active'));
            seasonContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // ==========================================
    // 🌟 4. كشف الحرق (Spoiler Reveal)
    // ==========================================
    const blurredReviews = document.querySelectorAll('.review-body.blurred');
    blurredReviews.forEach(review => {
        review.addEventListener('click', function() {
            if (this.classList.contains('blurred')) {
                this.classList.replace('blurred', 'revealed');
                const fullText = this.getAttribute('data-full-text');
                if (fullText) {
                    this.innerText = fullText; 
                }
            }
        });
    });

    // ==========================================
    // 🌟 5. أزرار تحريك قسم المراجعات (Reviews Carousel)
    // ==========================================
    const reviewsRow = document.getElementById('reviewsRow');
    const reviewPrevBtn = document.getElementById('reviewPrev');
    const reviewNextBtn = document.getElementById('reviewNext');

    if (reviewsRow && reviewPrevBtn && reviewNextBtn) {
        reviewPrevBtn.addEventListener('click', () => {
            const card = reviewsRow.querySelector('.minimal-review-card');
            const step = card ? card.offsetWidth + 16 : 300;
            reviewsRow.scrollBy({ left: -step, behavior: 'smooth' });
        });

        reviewNextBtn.addEventListener('click', () => {
            const card = reviewsRow.querySelector('.minimal-review-card');
            const step = card ? card.offsetWidth + 16 : 300;
            reviewsRow.scrollBy({ left: step, behavior: 'smooth' });
        });
    }

});