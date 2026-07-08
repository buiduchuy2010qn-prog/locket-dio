/**
 * friends.js — Kết bạn thật: tìm kiếm, gửi/chấp nhận/từ chối lời mời
 */

const DioFriends = (() => {
  let searchQuery = '';

  function init() {
    document.getElementById('friends-search')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });

    document.getElementById('btn-add-friend')?.addEventListener('click', () => {
      document.getElementById('add-friend-search').value = '';
      document.getElementById('add-friend-results').innerHTML = '';
      DioUI.openModal('modal-add-friend');
    });

    let searchTimer;
    document.getElementById('add-friend-search')?.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderSearchResults(e.target.value), 200);
    });
  }

  function renderSearchResults(query) {
    const user = DioDB.getCurrentUser();
    const container = document.getElementById('add-friend-results');
    if (!container || !user) return;

    if (!query.trim()) {
      container.innerHTML = '<p class="text-zinc-500 text-sm text-center py-4">Nhập email hoặc tên để tìm</p>';
      return;
    }

    const results = DioDB.searchUsers(query, user.id);
    const friends = DioDB.getFriends(user.id).map(f => f.id);
    const incoming = DioDB.getIncomingRequests(user.id).map(r => r.fromUserId);
    const outgoing = DioDB.getOutgoingRequests(user.id).map(r => r.toUserId);

    if (!results.length) {
      container.innerHTML = '<p class="text-zinc-500 text-sm text-center py-4">Không tìm thấy người dùng</p>';
      return;
    }

    container.innerHTML = results.map(u => {
      let action = '';
      if (friends.includes(u.id)) action = '<span class="text-xs text-zinc-500">Đã là bạn</span>';
      else if (incoming.includes(u.id)) action = '<span class="text-xs text-gold">Đã gửi lời mời cho bạn</span>';
      else if (outgoing.includes(u.id)) action = '<span class="text-xs text-zinc-500">Đã gửi lời mời</span>';
      else action = `<button type="button" class="btn-sm-gold" data-send-to="${u.id}">Kết bạn</button>`;

      return `
        <div class="user-search-row">
          <div class="avatar-circle">${u.avatar}</div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">${u.name}</p>
            <p class="text-xs text-zinc-500 truncate">${u.email}</p>
          </div>
          ${action}
        </div>`;
    }).join('');

    container.querySelectorAll('[data-send-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = DioDB.sendFriendRequest(user.id, btn.dataset.sendTo);
        if (r.ok) {
          DioUI.toast('Đã gửi lời mời kết bạn ✦');
          DioUI.haptic();
          renderSearchResults(query);
          render();
          updateBadges();
        } else DioUI.toast(r.error);
      });
    });
  }

  function render() {
    const user = DioDB.getCurrentUser();
    if (!user) return;

    const friends = DioDB.getFriends(user.id);
    const incoming = DioDB.getIncomingRequests(user.id);
    const q = searchQuery.toLowerCase();
    const filtered = friends.filter(f =>
      f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
    );

    const list = document.getElementById('friends-list');
    const requestsEl = document.getElementById('friend-requests');
    const countEl = document.getElementById('friends-count');

    if (countEl) countEl.textContent = `${friends.length} bạn bè`;

    if (requestsEl) {
      if (incoming.length) {
        requestsEl.innerHTML = `
          <p class="section-label">Lời mời kết bạn (${incoming.length})</p>
          ${incoming.map(r => `
            <div class="request-row" data-req="${r.id}">
              <div class="avatar-circle">${r.from.avatar}</div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold truncate">${r.from.name}</p>
                <p class="text-xs text-zinc-500">${r.from.email}</p>
              </div>
              <button type="button" class="btn-accept" data-accept="${r.id}">Chấp nhận</button>
              <button type="button" class="btn-reject" data-reject="${r.id}">Từ chối</button>
            </div>
          `).join('')}`;
        requestsEl.querySelectorAll('[data-accept]').forEach(btn => {
          btn.addEventListener('click', () => {
            DioDB.acceptFriendRequest(btn.dataset.accept, user.id);
            DioUI.toast('Đã kết bạn! ✦');
            render();
            DioCamera.renderFriendStrip();
            updateBadges();
          });
        });
        requestsEl.querySelectorAll('[data-reject]').forEach(btn => {
          btn.addEventListener('click', () => {
            DioDB.rejectFriendRequest(btn.dataset.reject, user.id);
            DioUI.toast('Đã từ chối lời mời');
            render();
            updateBadges();
          });
        });
      } else {
        requestsEl.innerHTML = '';
      }
    }

    if (list) {
      if (!filtered.length) {
        list.innerHTML = '<p class="text-zinc-500 text-center py-12">Chưa có bạn bè. Hãy tìm và kết bạn!</p>';
        return;
      }
      list.innerHTML = filtered.map(f => `
        <div class="friend-row" data-friend="${f.id}">
          <div class="avatar-circle avatar-gold">${f.avatar}</div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">${f.name}</p>
            <p class="text-xs text-zinc-500 truncate">${f.email}</p>
          </div>
          <button type="button" class="btn-icon-sm" data-chat="${f.id}" title="Nhắn tin"><i class="fa-solid fa-comment"></i></button>
        </div>
      `).join('');

      list.querySelectorAll('[data-chat]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          DioChat.openChat(btn.dataset.chat);
        });
      });

      list.querySelectorAll('.friend-row').forEach(row => {
        row.addEventListener('click', () => {
          const lockets = DioDB.getReceivedLockets(user.id)
            .filter(l => l.senderId === row.dataset.friend);
          if (lockets.length) DioHistory.openDetail(lockets[0].id);
          else DioUI.toast('Chưa có Locket từ bạn này');
        });
      });
    }
  }

  function updateBadges() {
    const user = DioDB.getCurrentUser();
    if (!user) return;
    const incoming = DioDB.getIncomingRequests(user.id).length;
    const unread = DioDB.getConversations(user.id).reduce((s, c) => s + c.unread, 0);
    const badgeFriends = document.getElementById('badge-friends');
    const badgeChat = document.getElementById('badge-chat');
    if (badgeFriends) {
      badgeFriends.textContent = incoming || '';
      badgeFriends.classList.toggle('hidden', !incoming);
    }
    if (badgeChat) {
      badgeChat.textContent = unread || '';
      badgeChat.classList.toggle('hidden', !unread);
    }
  }

  return { init, render, updateBadges };
})();