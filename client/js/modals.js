document.addEventListener('DOMContentLoaded', () => {

            // ==========================================
            // 🌟 1. تفاعلات نافذة السيرش 🌟
            // ==========================================
            const searchTriggers = document.querySelectorAll('.search-trigger-btn');
            const searchModal = document.getElementById('searchModal');
            const closeSearchBtn = searchModal ? searchModal.querySelector('.close-modal-btn') : null;

            if (searchModal) {
                searchTriggers.forEach(btn => {
                    btn.addEventListener('click', () => {
                        searchModal.style.display = 'flex';
                    });
                });

                if (closeSearchBtn) {
                    closeSearchBtn.addEventListener('click', () => {
                        searchModal.style.display = 'none';
                    });
                }
            }

            // ==========================================
            // 🌟 2. تفاعلات نافذة الـ Log 🌟
            // ==========================================
            const logModal = document.getElementById('logModal');
            const openLogBtn = document.getElementById('openLogModal'); // زرار הـ Hero
            const navLogBtn = document.getElementById('navLogBtn'); // زرار الـ Navbar
            const closeLogBtn = document.getElementById('closeLogModalBtn');
            const cancelLogBtn = document.getElementById('cancelLogBtn');

            function openLog() {
                if (logModal) logModal.style.display = 'flex';
            }

            function closeLog() {
                if (logModal) logModal.style.display = 'none';
            }

            if (openLogBtn) openLogBtn.addEventListener('click', openLog);
            if (navLogBtn) navLogBtn.addEventListener('click', openLog);
            if (closeLogBtn) closeLogBtn.addEventListener('click', closeLog);
            if (cancelLogBtn) cancelLogBtn.addEventListener('click', closeLog);

            // الإغلاق عند الضغط خارج النوافذ
            window.addEventListener('click', (e) => {
                if (e.target === searchModal) searchModal.style.display = 'none';
                if (e.target === logModal) closeLog();
            });

            // ==========================================
            // 🌟 3. لوجيك نافذة الـ Log الداخلي 🌟
            // ==========================================
            const dateInput = document.getElementById('watchDate');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }

            const toggleBtns = document.querySelectorAll('#logModal .icon-toggle-btn:not(.spoiler-btn)');
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', () => btn.classList.toggle('active'));
            });

            const spoilerBtn = document.querySelector('#logModal .spoiler-btn');
            if (spoilerBtn) {
                spoilerBtn.addEventListener('click', () => spoilerBtn.classList.toggle('spoiler-active'));
            }

            // نظام تقييم النجوم
            const stars = document.querySelectorAll('#logModal .rate-star');
            let currentRating = 0;

            function updateStars(value) {
                stars.forEach((star, index) => {
                    star.classList.remove('fa-solid', 'fa-regular', 'fa-star-half-stroke');
                    if (value >= index + 1) {
                        star.classList.add('fa-solid', 'fa-star');
                    } else if (value === index + 0.5) {
                        star.classList.add('fa-solid', 'fa-star-half-stroke');
                    } else {
                        star.classList.add('fa-regular', 'fa-star');
                    }
                });
            }

            stars.forEach((star, index) => {
                star.addEventListener('mousemove', function (e) {
                    const rect = this.getBoundingClientRect();
                    const isHalf = (e.clientX - rect.left) < (rect.width / 2);
                    const hoverValue = index + (isHalf ? 0.5 : 1);
                    updateStars(hoverValue);
                });

                star.addEventListener('mouseout', function () {
                    updateStars(currentRating);
                });

                star.addEventListener('click', function (e) {
                    const rect = this.getBoundingClientRect();
                    const isHalf = (e.clientX - rect.left) < (rect.width / 2);
                    currentRating = index + (isHalf ? 0.5 : 1);
                    updateStars(currentRating);
                });
            });

            // إغلاق قوائم Dropdown المنسدلة للبحث عند النقر في الخارج
            document.addEventListener('click', function (event) {
                const dropdowns = document.querySelectorAll('.css-dropdown');
                dropdowns.forEach(dropdown => {
                    if (!dropdown.contains(event.target)) {
                        dropdown.removeAttribute('open');
                    }
                });
            });
        });