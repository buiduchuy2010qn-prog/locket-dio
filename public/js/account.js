/**
 * account.js — Màn hình Đăng nhập / Đăng ký
 */

const DioAccount = (() => {
  let appBooted = false;

  function showAuth(mode = 'login') {
    document.getElementById('auth-gate')?.classList.remove('hidden');
    document.getElementById('main-app')?.classList.add('hidden');
    document.getElementById('panel-login')?.classList.toggle('hidden', mode !== 'login');
    document.getElementById('panel-register')?.classList.toggle('hidden', mode !== 'register');
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

  function clearErrors() {
    ['login-error', 'register-error'].forEach(id => {
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

    document.getElementById('form-login')?.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const r = DioAuth.login(
        document.getElementById('login-email').value,
        document.getElementById('login-password').value
      );
      if (r.ok) { showApp(); DioUI.toast(`Chào ${r.user.name}! ✦`); }
      else showError('login-error', r.error);
    });

    document.getElementById('form-register')?.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const r = DioAuth.register(
        document.getElementById('register-name').value,
        document.getElementById('register-email').value,
        document.getElementById('register-password').value,
        document.getElementById('register-confirm').value
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

    if (DioAuth.restore()) showApp();
    else showAuth('login');
  }

  return { init, showAuth, showApp };
})();