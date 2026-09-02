document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🌟 1. تفاعلات الفلاتر (Type Selector Pills) 🌟
    // ==========================================
    const typePills = document.querySelectorAll('.type-pill');
    
    typePills.forEach(pill => {
        pill.addEventListener('click', function() {
            typePills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const resetFilterBtn = document.querySelector('.reset-filter-btn');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            typePills.forEach(p => p.classList.remove('active'));
            if (typePills[0]) typePills[0].classList.add('active'); 
            
            // إضافي: نرجع الـ Dropdowns للوضع الافتراضي لو حابب
            const defaultTexts = ['Genre', 'Rating', 'Sort By', 'Year'];
            document.querySelectorAll('.css-dropdown .dropdown-selected span:first-child').forEach((span, index) => {
                if(defaultTexts[index]) span.textContent = defaultTexts[index];
            });
        });
    }

    // ==========================================
    // 🌟 2. تشغيل الـ Dropdowns (اعتماد الاختيار) 🌟
    // ==========================================
    const dropdownItems = document.querySelectorAll('.css-dropdown .dropdown-item');
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            // بنمسك القايمة الأساسية اللي اليوزر فاتحها
            const details = this.closest('details');
            // بنمسك الكلمة اللي ظاهرة فوق (Genre, Rating, إلخ)
            const summaryText = details.querySelector('.dropdown-selected span:first-child');
            
            // بنغير الكلمة اللي فوق باللي اليوزر اختاره
            summaryText.textContent = this.textContent;
            
            // بنقفل القايمة بعد الاختيار
            details.removeAttribute('open');
        });
    });

    // ==========================================
    // 🌟 3. تفاعلات الكروت (Watchlist & Details) 🌟
    // ==========================================
    const watchlistBtns = document.querySelectorAll('.btn-watchlist');
    
    watchlistBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault(); 
            this.classList.toggle('added');
            
            // تغيير النص من + لـ - من غير أي تغيير في الألوان
            if(this.classList.contains('added')) {
                this.textContent = '-';
                this.title = 'Remove from Watchlist';
            } else {
                this.textContent = '+';
                this.title = 'Add to Watchlist';
            }
        });
    });

    const detailsBtns = document.querySelectorAll('.btn-details');
    
    detailsBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = './details.html'; 
        });
    });

    // ==========================================
    // 🌟 4. تفاعلات أرقام الصفحات (Pagination) 🌟
    // ==========================================
    const pageBtns = document.querySelectorAll('.page-btn:not(.prev-next)');
    const prevBtn = document.querySelector('.page-btn.prev-next:first-child');
    const nextBtn = document.querySelector('.page-btn.prev-next:last-child');
    
    let currentPage = 1;
    const maxPage = 10;

    pageBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.classList.contains('disabled') || this.classList.contains('pagination-dots')) return;

            pageBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            currentPage = parseInt(this.textContent);
            updatePrevNextState();
        });
    });

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateActiveNumberInUI();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < maxPage) {
                currentPage++;
                updateActiveNumberInUI();
            }
        });
    }

    function updateActiveNumberInUI() {
        let foundBtn = Array.from(pageBtns).find(btn => parseInt(btn.textContent) === currentPage);
        if (foundBtn) {
            pageBtns.forEach(b => b.classList.remove('active'));
            foundBtn.classList.add('active');
        }
        updatePrevNextState();
    }

    function updatePrevNextState() {
        if (currentPage === 1) {
            prevBtn.classList.add('disabled');
            prevBtn.setAttribute('disabled', 'true');
        } else {
            prevBtn.classList.remove('disabled');
            prevBtn.removeAttribute('disabled');
        }

        if (currentPage === maxPage) {
            nextBtn.classList.add('disabled');
            nextBtn.setAttribute('disabled', 'true');
        } else {
            nextBtn.classList.remove('disabled');
            nextBtn.removeAttribute('disabled');
        }
    }
});