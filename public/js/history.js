/**
 * history.js — Feed Locket đã gửi & nhận (thật từ localStorage)
 */

const DioHistory = (() => {
  let filter = 'all';
  let currentDetailId = null;

  function init() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
    });
  }

  function getSenderName(senderId) {
    const u = DioDB.getUserById(senderId);
    return u?.name || 'Unknown';
  }

  function render() {
    const user = DioDB.getCurrentUser();
    const container = document.getElementById('history-grid');
    if (!user || !container) return;

    let lockets = DioDB.getAllLocketsForUser(user.id);
    if (filter === 'sent') lockets = DioDB.getSentLockets(user.id);
    if (filter === 'received') lockets = DioDB.getReceivedLockets(user.id);

    if (!lockets.length) {
      container.innerHTML = '<p class="text-zinc-500 text-center py-16 col-span-full">Chưa có Locket nào</p>';
      return;
    }

    container.innerHTML = lockets.map(l => {
      const isSent = l.senderId === user.id;
      const label = isSent ? 'Đã gửi' : getSenderName(l.senderId);
      const media = l.type === 'video'
        ? `<video src="${l.dataUrl}" class="history-thumb" muted></video><span class="video-tag">▶</span>`
        : `<img src="${l.dataUrl}" class="history-thumb" alt="">`;
      return `
        <button type="button" class="history-cell" data-locket="${l.id}">
          ${media}
          <div class="history-cell-overlay">
            <span class="text-[10px] font-semibold">${label}</span>
            ${l.caption ? `<span class="text-[9px] opacity-80 truncate">${l.caption}</span>` : ''}
          </div>
        </button>`;
    }).join('');

    container.querySelectorAll('[data-locket]').forEach(btn => {
      btn.addEventListener('click', () => openDetail(btn.dataset.locket));
    });
  }

  function openDetail(locketId) {
    const user = DioDB.getCurrentUser();
    const locket = DioDB.getAllLocketsForUser(user?.id || '').find(l => l.id === locketId)
      || DioDB.getReceivedLockets(user?.id || '').find(l => l.id === locketId);
    if (!locket || !user) return;

    currentDetailId = locketId;
    DioDB.markLocketViewed(locketId, user.id);

    const img = document.getElementById('detail-img');
    const vid = document.getElementById('detail-video');
    if (locket.type === 'video') {
      vid.src = locket.dataUrl;
      vid.classList.remove('hidden');
      img.classList.add('hidden');
      vid.play?.();
    } else {
      img.src = locket.dataUrl;
      img.classList.remove('hidden');
      vid.classList.add('hidden');
    }

    const isSent = locket.senderId === user.id;
    document.getElementById('detail-caption').textContent = locket.caption || '';
    document.getElementById('detail-meta').textContent = isSent
      ? `Gửi · ${new Date(locket.createdAt).toLocaleString('vi-VN')}`
      : `Từ ${getSenderName(locket.senderId)} · ${new Date(locket.createdAt).toLocaleString('vi-VN')}`;

    DioUI.openModal('modal-detail');
    DioCamera.renderFriendStrip();
  }

  return { init, render, openDetail };
})();