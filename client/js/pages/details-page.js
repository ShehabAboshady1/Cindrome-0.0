document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🌟 1. تفاعلات ولوجيك زرار הـ Log (من داخل الصفحة) 🌟
    // ==========================================
    const openLogBtn = document.getElementById('openLogModal'); // زرار הـ Hero
    
    // دالة لتصفير النجوم والأيقونات لما نفتح اللوج من الـ Hero
    function resetLocalLogState() {
        const stars = document.querySelectorAll('#logModal .rate-star');
        stars.forEach(star => {
            star.classList.remove('fa-solid', 'fa-star-half-stroke');
            star.classList.add('fa-regular', 'fa-star');
        });

        const toggleBtns = document.querySelectorAll('#logModal .icon-toggle-btn');
        toggleBtns.forEach(btn => btn.classList.remove('active', 'spoiler-active'));

        const reviewText = document.getElementById('reviewText');
        if (reviewText) reviewText.value = '';

        const defaultTexts = ['Season 1', 'All Episodes'];
        document.querySelectorAll('#logModal .dropdown-selected span:first-child').forEach((span, index) => {
            if (defaultTexts[index]) span.textContent = defaultTexts[index];
        });
    }

    if (openLogBtn) {
        openLogBtn.addEventListener('click', () => {
            resetLocalLogState();
            
            // بنخفي הסيرش ونظهر الـ البوستر بس عشان إحنا جوه صفحة المسلسل
            const logGlobalSearch = document.querySelector('#logModal .log-global-search');
            const logItemHeader = document.querySelector('#logModal .log-item-header');
            
            if (logGlobalSearch) logGlobalSearch.style.display = 'none';
            if (logItemHeader) logItemHeader.style.display = 'flex';
        });
    }

    // ==========================================
    // 🌟 2. تفاعل زرار الـ Watchlist الأساسي في الهيرو 🌟
    // ==========================================
    const heroWatchlistBtn = document.querySelector('.action-buttons .watchlist-btn');
    if (heroWatchlistBtn) {
        heroWatchlistBtn.addEventListener('click', function(e) {
            e.preventDefault();
            this.classList.toggle('added');
            const icon = this.querySelector('i');
            
            if (icon) {
                if (this.classList.contains('added')) {
                    icon.classList.replace('fa-regular', 'fa-solid');
                } else {
                    icon.classList.replace('fa-solid', 'fa-regular');
                }
            }
        });
    }

    // ==========================================
    // 🌟 3. تفاعل زرار الـ Like في الهيرو 🌟
    // ==========================================
    const likeHeroBtn = document.querySelector('.like-btn-hero');
    if (likeHeroBtn) {
        likeHeroBtn.addEventListener('click', function(e) {
            e.preventDefault();
            this.classList.toggle('liked');
            const icon = this.querySelector('i');
            if (icon) {
                if (this.classList.contains('liked')) {
                    icon.classList.replace('fa-regular', 'fa-solid');
                } else {
                    icon.classList.replace('fa-solid', 'fa-regular');
                }
            }
        });
    }

    // ==========================================
    // 🌟 4. تشغيل زرار الـ Like في المراجعات 🌟
    // ==========================================
    const reviewLikeBtns = document.querySelectorAll('.review-like-btn');
    reviewLikeBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            // بنعمل Toggle لكلاس is-liked والـ CSS هيلونه أحمر
            this.classList.toggle('is-liked');
            const icon = this.querySelector('i');
            if (icon) {
                if (this.classList.contains('is-liked')) {
                    icon.classList.replace('fa-regular', 'fa-solid');
                } else {
                    icon.classList.replace('fa-solid', 'fa-regular');
                }
            }
        });
    });

    // ==========================================
    // 🌟 5. تبديل المواسم وكشف الحرق والكاروسيل 🌟
    // ==========================================
    // المواسم
    const seasonBtns = document.querySelectorAll('.season-btn');
    const seasonContents = document.querySelectorAll('.season-content');
    seasonBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            seasonBtns.forEach(b => b.classList.remove('active'));
            seasonContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // الحرق (Spoilers)
    const blurredReviews = document.querySelectorAll('.review-body.blurred');
    blurredReviews.forEach(review => {
        review.addEventListener('click', function() {
            if (this.classList.contains('blurred')) {
                this.classList.replace('blurred', 'revealed');
                const fullText = this.getAttribute('data-full-text');
                if (fullText) this.innerText = fullText; 
            }
        });
    });

    // أزرار الكاروسيل للـ Reviews
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