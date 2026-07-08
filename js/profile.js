/**
 * profile.js — Thông tin tài khoản
 */

const DioProfile = (() => {
  function init() {
    document.getElementById('btn-admin-link')?.addEventListener('click', () => {
      DioAdmin.openAdminTab();
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

    const adminBadge = document.getElementById('profile-admin-badge');
    const adminRow = document.getElementById('btn-admin-link');
    const isAdmin = DioDB.isCurrentUserAdmin();

    if (adminBadge) adminBadge.classList.toggle('hidden', !isAdmin);
    if (adminRow) adminRow.classList.toggle('hidden', !isAdmin);

    DioAdmin.updateVisibility();
  }

  return { init, render };
})();