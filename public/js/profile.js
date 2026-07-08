/**
 * profile.js — Thông tin tài khoản
 */

const DioProfile = (() => {
  function init() {
    document.getElementById('btn-admin-link')?.addEventListener('click', () => {
      DioUI.openModal('modal-admin-login');
    });

    document.getElementById('admin-login-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const r = DioAuth.adminLogin(
        document.getElementById('admin-email').value,
        document.getElementById('admin-password').value
      );
      const err = document.getElementById('admin-login-error');
      if (r.ok) window.location.href = '/admin/';
      else {
        err.textContent = r.error;
        err.classList.remove('hidden');
      }
    });
  }

  function render() {
    const user = DioDB.getCurrentUser();
    if (!user) return;

    const friends = DioDB.getFriends(user.id);
    const sent = DioDB.getSentLockets(user.id).length;
    const received = DioDB.getReceivedLockets(user.id).length;

    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-avatar').textContent = user.avatar;
    document.getElementById('profile-stats').textContent =
      `${friends.length} bạn bè · ${sent} đã gửi · ${received} đã nhận`;
  }

  return { init, render };
})();