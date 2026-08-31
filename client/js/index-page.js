document.addEventListener('DOMContentLoaded', () => {

    // ==================================================
    // 🌟 1. تشغيل زرار الـ Watchlist في الـ Hero 🌟
    // ==================================================
    const heroWatchlistBtn = document.querySelector('.hero-watchlist-btn');
    if (heroWatchlistBtn) {
        heroWatchlistBtn.addEventListener('click', function() {
            // بيحط كلاس 'added' أو بيشيله
            this.classList.toggle('added');
        });
    }

    // ==================================================
    // 🌟 2. تشغيل زراير الـ Watchlist (+) الصغيرة في كروت الأفلام 🌟
    // ==================================================
    const cardWatchlistBtns = document.querySelectorAll('.btn-watchlist');
    cardWatchlistBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault(); 
            // بيحط كلاس 'added' أو بيشيله
            this.classList.toggle('added');
            
            // تغيير الـ title لما يتداس عليه عشان سهولة الاستخدام
            if (this.classList.contains('added')) {
                this.title = 'Remove from Watchlist';
            } else {
                this.title = 'Add to Watchlist';
            }
        });
    });

    // ==================================================
    // 🌟 3. تشغيل زراير الـ Like في كروت القوائم 🌟
    // ==================================================
    const listLikeBtns = document.querySelectorAll('.list-action-btn.like-btn');
    listLikeBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            // بيحط كلاس 'is-liked' أو بيشيله
            this.classList.toggle('is-liked');
        });
    });

});