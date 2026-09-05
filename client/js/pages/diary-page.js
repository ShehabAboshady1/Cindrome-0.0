document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🌟 1. تفاعلات القوائم المنسدلة (Dropdown Filters)
    // ==========================================
    const dropdownItems = document.querySelectorAll('.diary-filter-section .dropdown-item');
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const details = this.closest('details');
            const summarySpan = details.querySelector('.dropdown-selected span:first-child');
            summarySpan.textContent = this.textContent;
            details.removeAttribute('open');
        });
    });

    document.addEventListener('click', (e) => {
        document.querySelectorAll('.diary-filter-section details').forEach(details => {
            if (!details.contains(e.target)) {
                details.removeAttribute('open');
            }
        });
    });

    // ==========================================
    // 🌟 2. تفاعل زرار الحذف (Fade-out Delete)
    // ==========================================
    const deleteBtns = document.querySelectorAll('.delete-btn');
    
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('.diary-entry-row');
            row.classList.add('fade-out');
            setTimeout(() => {
                row.remove();
            }, 400); 
        });
    });

    // ==========================================
    // 🌟 3. تفاعل زرار التعديل (Edit Pre-fill Logic)
    // ==========================================
    const editBtns = document.querySelectorAll('.edit-btn');
    const logModal = document.getElementById('logModal');
    const modalTitle = logModal ? logModal.querySelector('.modal-main-title') : null;
    const reviewText = document.getElementById('reviewText');
    const likeToggle = document.getElementById('likeToggle');
    const rewatchToggle = document.getElementById('rewatchToggle');
    const spoilerToggle = document.getElementById('spoilerToggle'); 
    const stars = document.querySelectorAll('#logModal .rate-star');
    
    const logGlobalSearch = logModal ? logModal.querySelector('.log-global-search') : null;
    const logItemHeader = logModal ? logModal.querySelector('.log-item-header') : null;
    const modalPoster = logModal ? logModal.querySelector('.log-item-poster') : null;
    const modalItemTitle = logModal ? logModal.querySelector('.log-item-title') : null;
    const modalTypeBadge = logModal ? logModal.querySelector('.type-badge') : null;
    const seasonSelectors = logModal ? logModal.querySelector('.season-episode-selectors') : null;

    function updateModalStars(value) {
        stars.forEach((star, index) => {
            star.className = 'rate-star fa-star'; 
            if (value >= index + 1) {
                star.classList.add('fa-solid'); 
            } else if (value === index + 0.5) {
                star.classList.add('fa-solid', 'fa-star-half-stroke'); 
            } else {
                star.classList.add('fa-regular'); 
            }
        });
    }

    editBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const rating = parseFloat(this.getAttribute('data-rating')) || 0;
            const isLiked = this.getAttribute('data-liked') === 'true';
            const isRewatched = this.getAttribute('data-rewatched') === 'true';
            const isSpoiler = this.getAttribute('data-spoiler') === 'true'; 
            const review = this.getAttribute('data-review') || '';
            
            const itemTitle = this.getAttribute('data-title');
            const itemType = this.getAttribute('data-type');
            const itemPoster = this.getAttribute('data-poster');

            if (logGlobalSearch) logGlobalSearch.style.display = 'none';
            if (logItemHeader) logItemHeader.style.display = 'flex';

            if (modalTitle) modalTitle.textContent = "Edit Log";
            if (modalPoster && itemPoster) modalPoster.src = itemPoster;
            if (modalItemTitle && itemTitle) modalItemTitle.textContent = itemTitle;
            if (modalTypeBadge && itemType) modalTypeBadge.textContent = itemType;

            if (seasonSelectors) {
                if (itemType.toUpperCase() === 'MOVIE') {
                    seasonSelectors.style.display = 'none';
                } else {
                    seasonSelectors.style.display = 'flex';
                }
            }

            if (reviewText) reviewText.value = review;           
            updateModalStars(rating); 

            if (isLiked) likeToggle.classList.add('active');
            else likeToggle.classList.remove('active');

            if (isRewatched) rewatchToggle.classList.add('active');
            else rewatchToggle.classList.remove('active');

            // 🌟 التصليح هنا: استخدمنا spoiler-active بدل active 🌟
            if (isSpoiler && spoilerToggle) spoilerToggle.classList.add('spoiler-active');
            else if (spoilerToggle) spoilerToggle.classList.remove('spoiler-active');

            if (logModal) logModal.style.display = 'flex';
        });
    });

    // ==========================================
    // 🌟 4. إضافة تقييم جديد من الناف بار (Log Button) 🌟
    // ==========================================
    const navLogBtn = document.getElementById('navLogBtn');
    if (navLogBtn) {
        navLogBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.textContent = "Log Content";
            if (reviewText) reviewText.value = "";
            updateModalStars(0);
            if (likeToggle) likeToggle.classList.remove('active');
            if (rewatchToggle) rewatchToggle.classList.remove('active');
            
            // 🌟 التصليح هنا كمان: استخدمنا spoiler-active لتصفير الزرار 🌟
            if (spoilerToggle) spoilerToggle.classList.remove('spoiler-active');
            
            if (logGlobalSearch) logGlobalSearch.style.display = 'flex';
            if (logItemHeader) logItemHeader.style.display = 'none';

            // تصفير البوستر الافتراضي كاحتياط
            if (modalPoster) modalPoster.src = "../assets/posters/poster-sherlock.webp"; 
            if (modalItemTitle) modalItemTitle.textContent = "Sherlock"; 
            if (modalTypeBadge) modalTypeBadge.textContent = "TV SERIES"; 
            if (seasonSelectors) seasonSelectors.style.display = 'flex';

            if (logModal) logModal.style.display = 'flex';
        });
    }

    const closeLogBtn = document.getElementById('closeLogModalBtn');
    const cancelLogBtn = document.getElementById('cancelLogBtn');
    function closeLog() { if (logModal) logModal.style.display = 'none'; }
    if (closeLogBtn) closeLogBtn.addEventListener('click', closeLog);
    if (cancelLogBtn) cancelLogBtn.addEventListener('click', closeLog);

});