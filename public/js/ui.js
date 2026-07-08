/**
 * ui.js — Navigation, modals, toast
 */

const DioUI = (() => {
  let activeTab = 'camera';
  let toastTimer;

  function initTabs(onChange) {
    document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab, onChange));
    });
  }

  function setActiveNav(tab) {
    document.querySelectorAll('.nav-tab[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  function switchTab(tab, onChange) {
    if (tab === 'admin' && !DioDB.isCurrentUserAdmin()) {
      toast('Tài khoản không có quyền Admin');
      return;
    }
    if (activeTab === tab) return;
    activeTab = tab;
    setActiveNav(tab);
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.toggle('active', s.dataset.screen === tab);
    });
    onChange?.(tab);
  }

  function getActiveTab() { return activeTab; }

  function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    if (!document.querySelector('.modal:not(.hidden)')) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  function initModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeModal(modal.id));
      modal.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modal.id));
      });
    });
  }

  function toast(msg, ms = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function haptic() { navigator.vibrate?.(10); }

  function emojiRain() {
    const container = document.getElementById('emoji-rain');
    if (!container) return;
    container.innerHTML = '';
    const emojis = ['❤️', '✨', '💛', '🔥', '😍', '⭐', '💫', '🎉'];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('span');
      el.className = 'emoji-particle';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = `${Math.random() * 100}%`;
      el.style.fontSize = `${18 + Math.random() * 20}px`;
      el.style.animationDuration = `${2 + Math.random() * 2}s`;
      el.style.animationDelay = `${Math.random() * 0.8}s`;
      container.appendChild(el);
    }
    setTimeout(() => { container.innerHTML = ''; }, 4000);
  }

  return {
    initTabs, switchTab, getActiveTab, setActiveNav,
    openModal, closeModal, initModals, toast, haptic, emojiRain,
  };
})();