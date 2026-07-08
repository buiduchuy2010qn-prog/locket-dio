/**
 * account.js — Đăng nhập / Đăng ký (ảnh 2)
 */

const DioAccount = (() => {
  const REMEMBER_KEY = 'locket_dio_remember';
  let appBooted = false;

  function showPanel(panel) {
    ['panel-login', 'panel-register', 'panel-phone'].forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', id !== `panel-${panel}`);
    });
    clearErrors();
  }

  function showAuth(mode = 'login') {
    document.getElementById('auth-gate')?.classList.remove('hidden');
    document.getElementById('main-app')?.classList.add('hidden');
    showPanel(mode);
    if (mode === 'login') loadRememberedEmail();
    clearErrors();
  }

  function showApp() {
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');
    if (!appBooted) {
      DioApp.boot();
      appBooted = true;
    } else {
      DioApp.refresh();
    }
  }

  function loadRememberedEmail() {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const emailEl = document.getElementById('login-email');
      const rememberEl = document.getElementById('login-remember');
      if (data.email && emailEl) emailEl.value = data.email;
      if (rememberEl) rememberEl.checked = !!data.remember;
    } catch (_) { /* ignore */ }
  }

  function saveRemember(email, remember) {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: email.trim(), remember: true }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }

  function clearErrors() {
    ['login-error', 'register-error', 'phone-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }

  function init() {
    document.getElementById('btn-show-register')?.addEventListener('click', () => showAuth('register'));
    document.getElementById('btn-show-login')?.addEventListener('click', () => showAuth('login'));
    document.getElementById('btn-back-login')?.addEventListener('click', () => showAuth('login'));
    document.getElementById('btn-back-login-from-reg')?.addEventListener('click', () => showAuth('login'));
    document.getElementById('btn-phone-login')?.addEventListener('click', () => showAuth('phone'));

    document.getElementById('btn-forgot-password')?.addEventListener('click', () => {
      const email = document.getElementById('login-email')?.value || '';
      const forgotEl = document.getElementById('forgot-email');
      if (forgotEl && email) forgotEl.value = email;
      DioUI.openModal('modal-forgot');
    });

    document.getElementById('btn-forgot-submit')?.addEventListener('click', () => {
      const email = document.getElementById('forgot-email')?.value?.trim();
      if (!email) {
        DioUI.toast('Vui lòng nhập email');
        return;
      }
      const user = DioDB.getUserByEmail(email);
      DioUI.closeModal('modal-forgot');
      if (user) {
        DioUI.toast('Dữ liệu lưu local — hãy đăng ký tài khoản mới hoặc liên hệ admin');
      } else {
        DioUI.toast('Email chưa được đăng ký');
      }
    });

    document.getElementById('form-login')?.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const remember = document.getElementById('login-remember')?.checked;
      const r = DioAuth.login(email, password);
      if (r.ok) {
        saveRemember(email, remember);
        showApp();
        DioUI.toast(`Chào ${r.user.name}! ✦`);
      } else showError('login-error', r.error);
    });

    document.getElementById('form-phone')?.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const phone = document.getElementById('login-phone').value;
      const password = document.getElementById('login-phone-password').value;
      const r = DioAuth.loginByPhone(phone, password);
      if (r.ok) {
        showApp();
        DioUI.toast(`Chào ${r.user.name}! ✦`);
      } else showError('phone-error', r.error);
    });

    document.getElementById('form-register')?.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const r = DioAuth.register(
        document.getElementById('register-name').value,
        document.getElementById('register-email').value,
        document.getElementById('register-password').value,
        document.getElementById('register-confirm').value,
        document.getElementById('register-phone')?.value || ''
      );
      if (r.ok) { showApp(); DioUI.toast('Đăng ký thành công! ✦'); }
      else showError('register-error', r.error);
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      DioCamera.onTabLeave?.();
      DioAuth.logout();
      showAuth('login');
      DioUI.toast('Đã đăng xuất');
    });

    DioUI.initModals();

    if (DioAuth.restore()) showApp();
    else showAuth('login');
  }

  return { init, showAuth, showApp };
})();