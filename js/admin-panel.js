/**
 * admin-panel.js — Admin tích hợp trong app (chỉ tài khoản ủy quyền)
 */

const DioAdmin = (() => {
  let activePanel = 'dashboard';
  const TITLES = { dashboard: 'Dashboard', users: 'Quản lý Users', lockets: 'Quản lý Lockets' };

  function init() {
    document.querySelectorAll('[data-admin-panel]').forEach(btn => {
      btn.addEventListener('click', () => switchPanel(btn.dataset.adminPanel));
    });
  }

  function canAccess() {
    return DioDB.isCurrentUserAdmin();
  }

  /** Hiện/ẩn nút Admin theo quyền user đăng nhập */
  function updateVisibility() {
    const isAdmin = canAccess();
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin);
    });
    if (!isAdmin && DioUI.getActiveTab() === 'admin') {
      DioUI.switchTab('camera', DioApp.onTabChange);
    }
  }

  function switchPanel(panel) {
    if (!canAccess()) return;
    activePanel = panel;
    document.querySelectorAll('[data-admin-panel]').forEach(b => {
      b.classList.toggle('active', b.dataset.adminPanel === panel);
    });
    document.querySelectorAll('.admin-subpanel').forEach(p => {
      p.classList.toggle('active', p.id === `admin-panel-${panel}`);
    });
    const title = document.getElementById('admin-screen-title');
    if (title) title.textContent = TITLES[panel] || panel;
    renderPanel(panel);
  }

  function render() {
    if (!canAccess()) return;
    switchPanel(activePanel);
  }

  function renderPanel(panel) {
    if (panel === 'dashboard') renderDashboard();
    if (panel === 'users') renderUsers();
    if (panel === 'lockets') renderLockets();
  }

  function renderDashboard() {
    DioDB.reload();
    const s = DioDB.getStats();
    const el = document.getElementById('admin-stats-grid');
    if (!el) return;
    el.innerHTML = `
      <div class="admin-stat"><div class="admin-stat-num">${s.totalUsers}</div><div class="admin-stat-label">Users</div></div>
      <div class="admin-stat"><div class="admin-stat-num">${s.totalFriends}</div><div class="admin-stat-label">Friendships</div></div>
      <div class="admin-stat"><div class="admin-stat-num">${s.totalMessages}</div><div class="admin-stat-label">Messages</div></div>
      <div class="admin-stat"><div class="admin-stat-num">${s.totalLockets}</div><div class="admin-stat-label">Lockets</div></div>
      <div class="admin-stat"><div class="admin-stat-num">${s.pendingRequests}</div><div class="admin-stat-label">Pending</div></div>
    `;
  }

  function renderUsers() {
    const users = DioDB.getUsers();
    const el = document.getElementById('admin-users-table');
    if (!el) return;
    el.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Tên</th><th>Email</th><th>Trạng thái</th><th>Tham gia</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td class="text-zinc-400 text-sm">${u.email}</td>
            <td>
              ${u.isAdmin ? '<span class="admin-badge gold">Admin</span>' : ''}
              ${u.isBanned ? '<span class="admin-badge ban">Banned</span>' : '<span class="admin-badge ok">Active</span>'}
            </td>
            <td class="text-xs text-zinc-500">${new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
            <td class="admin-actions">
              ${u.isAdmin ? '' : `
                <button type="button" class="admin-btn-sm" data-ban="${u.id}">${u.isBanned ? 'Mở khóa' : 'Khóa'}</button>
                <button type="button" class="admin-btn-sm danger" data-del-user="${u.id}">Xóa</button>
              `}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>`;

    el.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Xóa user và toàn bộ dữ liệu liên quan?')) {
          DioDB.deleteUser(btn.dataset.delUser);
          render();
          DioApp.refresh();
        }
      });
    });

    el.querySelectorAll('[data-ban]').forEach(btn => {
      btn.addEventListener('click', () => {
        DioDB.toggleBanUser(btn.dataset.ban);
        render();
      });
    });
  }

  function renderLockets() {
    DioDB.reload();
    const lockets = DioDB.getAllLockets();
    const el = document.getElementById('admin-lockets-table');
    if (!el) return;

    if (!lockets.length) {
      el.innerHTML = '<p class="text-zinc-500 text-center py-12">Chưa có Locket</p>';
      return;
    }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr><th></th><th>Loại</th><th>Người gửi</th><th>Caption</th><th>Thời gian</th><th></th></tr></thead>
        <tbody>${lockets.map(l => {
          const sender = DioDB.getUserById(l.senderId);
          const thumb = l.type === 'video'
            ? `<video src="${l.dataUrl}" class="admin-thumb" muted></video>`
            : `<img src="${l.dataUrl}" class="admin-thumb" alt="">`;
          return `<tr>
            <td>${thumb}</td>
            <td>${l.type}</td>
            <td>${sender?.name || '—'}</td>
            <td class="text-sm text-zinc-400 max-w-[180px] truncate">${l.caption || '—'}</td>
            <td class="text-xs text-zinc-500">${new Date(l.createdAt).toLocaleString('vi-VN')}</td>
            <td><button type="button" class="admin-btn-sm danger" data-del-locket="${l.id}">Xóa</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    el.querySelectorAll('[data-del-locket]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Xóa Locket này?')) {
          DioDB.deleteLocket(btn.dataset.delLocket);
          render();
          DioHistory.render();
        }
      });
    });
  }

  function openAdminTab() {
    if (!canAccess()) {
      DioUI.toast('Tài khoản không có quyền Admin');
      return;
    }
    DioUI.switchTab('admin', DioApp.onTabChange);
  }

  return { init, render, updateVisibility, openAdminTab, canAccess };
})();