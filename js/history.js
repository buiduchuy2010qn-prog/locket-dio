/**
 * history.js — Feed grid (Mọi người / Làm mới) — ảnh 3
 */

const DioHistory = (() => {
  let feedMode = 'everyone';
  let refreshKey = 0;

  const EXPLORE_SAMPLES = [
    { id: 'sample_1', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80', aspect: 'aspect-portrait', caption: 'Pizza ngon 🍕' },
    { id: 'sample_2', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', aspect: 'aspect-landscape', caption: 'Phong cảnh núi' },
    { id: 'sample_3', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80', aspect: 'aspect-portrait', caption: 'Portrait' },
    { id: 'sample_4', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', aspect: 'aspect-square', caption: 'Đồ chơi vintage' },
    { id: 'sample_5', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80', aspect: 'aspect-portrait', caption: 'Salad healthy 🥗' },
    { id: 'sample_6', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80', aspect: 'aspect-landscape', caption: 'Sương sớm' },
    { id: 'sample_7', url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&q=80', aspect: 'aspect-square', caption: 'Cún cute 🐶' },
    { id: 'sample_8', url: 'https://images.unsplash.com/photo-1493770348161-369ebaae3c9?w=400&q=80', aspect: 'aspect-portrait', caption: 'Brunch time' },
    { id: 'sample_9', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80', aspect: 'aspect-landscape', caption: 'Thiên nhiên' },
    { id: 'sample_10', url: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&q=80', aspect: 'aspect-portrait', caption: 'Gaming setup 🎮' },
    { id: 'sample_11', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80', aspect: 'aspect-square', caption: 'Healthy bowl' },
    { id: 'sample_12', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', aspect: 'aspect-portrait', caption: 'Smile ✨' },
  ];

  function init() {
    document.querySelectorAll('[data-feed]').forEach(btn => {
      btn.addEventListener('click', () => {
        feedMode = btn.dataset.feed;
        document.querySelectorAll('[data-feed]').forEach(b => b.classList.toggle('active', b === btn));
        if (feedMode === 'refresh') {
          refreshKey++;
          DioUI.toast('Đã làm mới feed ✦');
        }
        render();
      });
    });
  }

  function getSenderName(senderId) {
    const u = DioDB.getUserById(senderId);
    return u?.name || 'Unknown';
  }

  function isNewForUser(locket, userId) {
    return locket.senderId !== userId && !(locket.viewedBy || []).includes(userId);
  }

  function buildCell(locket, user, idx) {
    const isSent = locket.senderId === user.id;
    const isSample = String(locket.id).startsWith('sample_');
    const label = isSample ? 'Khám phá' : (isSent ? 'Bạn' : getSenderName(locket.senderId));
    const isNew = !isSample && isNewForUser(locket, user.id);
    const aspects = ['aspect-portrait', 'aspect-square', 'aspect-landscape'];
    const aspect = locket.aspect || aspects[idx % 3];
    const media = locket.type === 'video'
      ? `<div class="${aspect}"><video src="${locket.dataUrl}" class="feed-thumb" muted></video></div><span class="video-tag">▶ Video</span>`
      : `<div class="${aspect}"><img src="${locket.dataUrl}" class="feed-thumb" alt="" loading="lazy"></div>`;

    return `
      <button type="button" class="feed-cell" data-locket="${locket.id}" data-sample="${isSample}" style="animation-delay:${(idx % 12) * 40}ms">
        ${media}
        ${isNew ? '<span class="feed-new-dot"></span>' : ''}
        <div class="feed-cell-overlay">
          <span class="feed-cell-name">${label}</span>
          ${locket.caption ? `<span class="feed-cell-cap">${locket.caption}</span>` : ''}
        </div>
      </button>`;
  }

  function render() {
    const user = DioDB.getCurrentUser();
    const container = document.getElementById('history-grid');
    if (!user || !container) return;

    let lockets = DioDB.getAllLocketsForUser(user.id);

    if (feedMode === 'refresh') {
      lockets = lockets
        .filter(l => isNewForUser(l, user.id) || l.senderId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      lockets = [...lockets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const items = lockets.length
      ? lockets.map((l, i) => ({ ...l, dataUrl: l.dataUrl }))
      : EXPLORE_SAMPLES.map(s => ({ ...s, type: 'photo', dataUrl: s.url, senderId: 'explore', createdAt: new Date().toISOString() }));

    const hint = feedMode === 'refresh' && lockets.length
      ? `<p class="feed-refresh-hint col-span-full">Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}</p>`
      : '';

    container.innerHTML = hint + items.map((l, i) => buildCell(l, user, i)).join('');

    container.querySelectorAll('[data-locket]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.sample === 'true') {
          DioUI.toast('Ảnh khám phá · Kết bạn để nhận Locket thật!');
          return;
        }
        openDetail(btn.dataset.locket);
      });
    });
  }

  function openDetail(locketId) {
    const user = DioDB.getCurrentUser();
    const locket = DioDB.getAllLocketsForUser(user?.id || '').find(l => l.id === locketId)
      || DioDB.getReceivedLockets(user?.id || '').find(l => l.id === locketId);
    if (!locket || !user) return;

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
    render();
  }

  return { init, render, openDetail };
})();