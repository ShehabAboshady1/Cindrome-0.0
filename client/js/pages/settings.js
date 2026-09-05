document.addEventListener('DOMContentLoaded', () => {

    // ==================================================
    // 🌟 1. التنقل بين التبويبات (Tabs Switching)
    // ==================================================
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');

    function switchTab(targetTabId, activeBtn) {
        panels.forEach(panel => {
            panel.style.display = 'none';
        });

        const targetPanel = document.getElementById(`tab-${targetTabId}`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        }

        tabBtns.forEach(btn => btn.classList.remove('is-active'));
        if (activeBtn) {
            activeBtn.classList.add('is-active');
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId, this);
        });
    });

    // ==================================================
    // 🌟 2. مزامنة حالة الحساب الخاص (Private Account)
    // ==================================================
    const privateAccountToggle = document.getElementById('privateAccountToggle');
    const savePrivacyBtn = document.getElementById('savePrivacyBtn');

    // قراءة الحالة المحفوظة مسبقاً لعرضها في السويتش
    const savedPrivacy = localStorage.getItem('cindrome_is_private');
    if (privateAccountToggle && savedPrivacy !== null) {
        privateAccountToggle.checked = (savedPrivacy === 'true');
    }

    if (savePrivacyBtn && privateAccountToggle) {
        savePrivacyBtn.addEventListener('click', () => {
            const isPrivate = privateAccountToggle.checked;
            localStorage.setItem('cindrome_is_private', isPrivate);

            // تغذية بصرية بحفظ التعديل
            const originalText = savePrivacyBtn.textContent;
            savePrivacyBtn.textContent = 'Saved';
            savePrivacyBtn.style.backgroundColor = '#0be3e3';

            setTimeout(() => {
                savePrivacyBtn.textContent = originalText;
                savePrivacyBtn.style.backgroundColor = '';
            }, 1800);
        });
    }

    // ==================================================
    // 🌟 3. تفاعل حفظ الإشعارات (Notification Settings)
    // ==================================================
    const saveNotificationsBtn = document.getElementById('saveNotificationsBtn');
    if (saveNotificationsBtn) {
        saveNotificationsBtn.addEventListener('click', () => {
            const originalText = saveNotificationsBtn.textContent;
            saveNotificationsBtn.textContent = 'Saved';
            saveNotificationsBtn.style.backgroundColor = '#0be3e3';

            setTimeout(() => {
                saveNotificationsBtn.textContent = originalText;
                saveNotificationsBtn.style.backgroundColor = '';
            }, 1800);
        });
    }

    // ==================================================
    // 🌟 4. تغيير الإيميل وكلمة السر (Validation & Feedback)
    // ==================================================
    const changeEmailBtn = document.getElementById('changeEmailBtn');
    const newEmailInput = document.getElementById('newEmailInput');

    if (changeEmailBtn && newEmailInput) {
        changeEmailBtn.addEventListener('click', () => {
            const emailValue = newEmailInput.value.trim();
            if (!emailValue) {
                newEmailInput.focus();
                return;
            }
            const originalText = changeEmailBtn.textContent;
            changeEmailBtn.textContent = 'Link Sent';
            setTimeout(() => {
                changeEmailBtn.textContent = originalText;
                newEmailInput.value = '';
            }, 2000);
        });
    }

    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    const currentPassInput = document.getElementById('currentPasswordInput');
    const newPassInput = document.getElementById('newPasswordInput');
    const confirmPassInput = document.getElementById('confirmPasswordInput');

    if (updatePasswordBtn && currentPassInput && newPassInput && confirmPassInput) {
        updatePasswordBtn.addEventListener('click', () => {
            if (!currentPassInput.value || !newPassInput.value || !confirmPassInput.value) {
                alert('Please fill in all password fields.');
                return;
            }
            if (newPassInput.value !== confirmPassInput.value) {
                alert('New passwords do not match.');
                return;
            }

            const originalText = updatePasswordBtn.textContent;
            updatePasswordBtn.textContent = 'Password Updated';
            setTimeout(() => {
                updatePasswordBtn.textContent = originalText;
                currentPassInput.value = '';
                newPassInput.value = '';
                confirmPassInput.value = '';
            }, 2000);
        });
    }

    // ==================================================
    // 🌟 5. نافذة تأكيد حذف الحساب (Delete Account Modal)
    // ==================================================
    const deleteModal = document.getElementById('deleteAccountModal');
    const openDeleteBtn = document.getElementById('openDeleteModalBtn');
    const closeDeleteBtn = document.getElementById('closeDeleteModalBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    function openDeleteModal() {
        if (deleteModal) deleteModal.style.display = 'flex';
    }

    function closeDeleteModal() {
        if (deleteModal) deleteModal.style.display = 'none';
    }

    if (openDeleteBtn) openDeleteBtn.addEventListener('click', openDeleteModal);
    if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', closeDeleteModal);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = './sign-in.html';
        });
    }

});