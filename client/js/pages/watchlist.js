
document.addEventListener('DOMContentLoaded', () => {

    const cardsGrid = document.querySelector('.watchlist-cards-grid');
    const miniCards = document.querySelectorAll('.mini-content-card');
    const gridCountText = document.querySelector('.grid-count-text');

    // ==================================================
    // 🌟 1. تفاعلات الكروت (حذف / قلب / شريط الموبايل)
    // ==================================================
    const minusIconSvg = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;

    const plusIconSvg = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;

    if (cardsGrid) {
        cardsGrid.addEventListener('click', (e) => {
            // زر الحذف/الإعادة من قائمة الـ Watchlist
            const addBtn = e.target.closest('.btn-add');
            if (addBtn) {
                e.preventDefault();
                e.stopPropagation();

                const isRemoved = addBtn.classList.toggle('is-removed');
                addBtn.innerHTML = isRemoved ? plusIconSvg : minusIconSvg;
                addBtn.setAttribute('title', isRemoved ? 'Add back to Watchlist' : 'Remove from Watchlist');
                return;
            }

            // زر المفضلة / القلب
            const favBtn = e.target.closest('.btn-fav');
            if (favBtn) {
                e.preventDefault();
                e.stopPropagation();
                favBtn.classList.toggle('is-favorited');
                return;
            }

            // إظهار وإخفاء شريط الأزرار عند الضغط في الموبايل
            const card = e.target.closest('.mini-content-card');
            if (card && window.innerWidth <= 768) {
                if (e.target.closest('.mini-bar-btn')) return;

                const isShowing = card.classList.contains('show-bar');
                miniCards.forEach(c => c.classList.remove('show-bar'));

                if (!isShowing) {
                    card.classList.add('show-bar');
                }
            }
        });

        // إغلاق أي شريط كارت مفتوح عند النقر خارج الكروت في الموبايل
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mini-content-card') && window.innerWidth <= 768) {
                miniCards.forEach(c => c.classList.remove('show-bar'));
            }
        });
    }

    // ==================================================
    // 🌟 2. الفلترة المباشرة وتحديث العداد (Filter Bar)
    // ==================================================
    const searchInput = document.getElementById('filterSearchInput');
    const typePills = document.querySelectorAll('.type-selector .type-pill');
    const dropdownItems = document.querySelectorAll('.dropdowns-group .dropdown-item');
    const resetBtn = document.querySelector('.reset-filter-btn');

    let currentTypeFilter = 'all';

    function updateCount() {
        if (!gridCountText) return;
        const visibleCards = document.querySelectorAll('.mini-content-card:not([style*="display: none"])');
        gridCountText.textContent = `${visibleCards.length} Titles`;
    }

    function filterCards() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        miniCards.forEach(card => {
            const title = (card.getAttribute('data-tooltip') || '').toLowerCase();
            const type = (card.getAttribute('data-type') || '').toLowerCase();

            const matchesSearch = !query || title.includes(query);
            const matchesType = (currentTypeFilter === 'all') || (type === currentTypeFilter);

            if (matchesSearch && matchesType) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });

        updateCount();
    }

    // البحث اللحظي بالاسم
    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }

    // فلاتر النوع (All, Anime, Movies, Series)
    typePills.forEach(pill => {
        pill.addEventListener('click', () => {
            typePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentTypeFilter = pill.getAttribute('data-type') || 'all';
            filterCards();
        });
    });

    // اختيار عناصر القوائم المنسدلة وتحديث النص الظاهر
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const details = item.closest('.css-dropdown');
            if (details) {
                const selectedSpan = details.querySelector('.selected-text');
                if (selectedSpan) {
                    selectedSpan.textContent = item.textContent.trim();
                }
                details.removeAttribute('open');
            }
        });
    });

    // زر إعادة تعيين الفلاتر (Reset)
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';

            typePills.forEach(p => p.classList.remove('active'));
            const allPill = document.querySelector('.type-pill[data-type="all"]');
            if (allPill) allPill.classList.add('active');
            currentTypeFilter = 'all';

            // إعادة نصوص القوائم المنسدلة إلى أصلها
            const dropdownDefaults = ['Genre', 'Rating', 'Sort By', 'Year'];
            const dropdownSummaries = document.querySelectorAll('.dropdowns-group .selected-text');
            dropdownSummaries.forEach((span, idx) => {
                if (dropdownDefaults[idx]) span.textContent = dropdownDefaults[idx];
            });

            miniCards.forEach(card => card.style.display = '');
            updateCount();
        });
    }
});