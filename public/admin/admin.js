/**
 * admin.js — Locket Dio Admin Panel
 */

(() => {
  const $ = id => document.getElementById(id);
  const TITLES = { dashboard: 'Dashboard', users: 'Quản lý Users', lockets: 'Quản lý Lockets' };

  function init() {
    if (DioDB.isAdminSession()) showAdmin();
    else showLogin();

    $('login-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const r = DioAuth.adminLogin($('login-email').value, $('login-password').value);
      const err = $('login-error');
      if (r.ok) { err.classList.add('hidden'); showAdmin(); }
      else { err.textContent = r.error; err.classList.remove('hidden'); }
    });

    $('btn-logout')?.addEventListener('click', () => {
      DioAuth.adminLogout();
      showLogin();
    });

    document.querySelectorAll('[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
    });
  }

  function showLogin() {
    $('login-screen')?.classList.remove('hidden');
    $('admin-app')?.classList.add('hidden');
  }

  function showAdmin() {
    $('login-screen')?.classList.add('hidden');
    $('admin-app')?.classList.remove('hidden');
    $('admin-email-display').textContent = DioDB.ADMIN_DEFAULT.email;
    DioDB.reload();
    renderAll();
  }

  function switchPanel(panel) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-nav-btn[data-panel]').forEach(b => b.classList.remove('active'));
    $(`panel-${panel}`)?.classList.add('active');
    document.querySelector(`[data-panel="${panel}"]`)?.classList.add('active');
    $('panel-title').textContent = TITLES[panel] || panel;
    if (panel === 'users') renderUsers();
    if (panel === 'lockets') renderLockets();
  }

  function renderAll() {
    renderDashboard();
    renderUsers();
    renderLockets();
  }

  function renderDashboard() {
    const s = DioDB.getStats();
    $('stats-grid').innerHTML = `
      <div class="stat-card"><div class="num">${s.totalUsers}</div><div class="label">Users</div></div>
      <div class="stat-card"><div class="num">${s.totalFriends}</div><div class="label">Friendships</div></div>
      <div class="stat-card"><div class="num">${s.totalMessages}</div><div class="label">Messages</div></div>
      <div class="stat-card"><div class="num">${s.totalLockets}</div><div class="label">Lockets</div></div>
      <div class="stat-card"><div class="num">${s.pendingRequests}</div><div class="label">Pending Requests</div></div>
    `;
  }

  function renderUsers() {
    const users = DioDB.getUsers();
    $('users-table').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Tham gia</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${u.isAdmin ? '<span class="badge badge-admin">Admin</span>' : ''}${u.isBanned ? '<span class="badge badge-banned">Banned</span>' : ''}</td>
            <td class="text-zinc-500 text-xs">${new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
            <td>${u.isAdmin ? '' : `<button type="button" class="admin-action danger" data-del-user="${u.id}">Xóa</button>`}</td>
          </tr>
        `).join('')}</tbody>
      </table>`;

    document.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Xóa user này? Dữ liệu liên quan cũng bị xóa.')) {
          DioDB.deleteUser(btn.dataset.delUser);
          renderAll();
        }
      });
    });
  }

  function renderLockets() {
    DioDB.reload();
    const lockets = DioDB.getAllLockets();

    if (!lockets.length) {
      $('lockets-table').innerHTML = '<p class="text-zinc-500 py-8 text-center">Chưa có Locket</p>';
      return;
    }

    $('lockets-table').innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Preview</th><th>Loại</th><th>Người gửi</th><th>Caption</th><th>Thời gian</th><th></th></tr></thead>
        <tbody>${lockets.map(l => {
          const sender = DioDB.getUserById(l.senderId);
          const thumb = l.type === 'video'
            ? `<video src="${l.dataUrl}" class="locket-thumb" muted></video>`
            : `<img src="${l.dataUrl}" class="locket-thumb" alt="">`;
          return `<tr>
            <td>${thumb}</td>
            <td>${l.type}</td>
            <td>${sender?.name || l.senderId}</td>
            <td class="text-zinc-400 text-sm max-w-[200px] truncate">${l.caption || '—'}</td>
            <td class="text-xs text-zinc-500">${new Date(l.createdAt).toLocaleString('vi-VN')}</td>
            <td><button type="button" class="admin-action danger" data-del-locket="${l.id}">Xóa</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    document.querySelectorAll('[data-del-locket]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Xóa Locket này?')) {
          DioDB.deleteLocket(btn.dataset.delLocket);
          renderAll();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();