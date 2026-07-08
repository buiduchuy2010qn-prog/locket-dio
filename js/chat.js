/**
 * chat.js — Nhắn tin thật giữa bạn bè (localStorage)
 */

const DioChat = (() => {
  let activeFriendId = null;

  function init() {
    document.getElementById('chat-form')?.addEventListener('submit', e => {
      e.preventDefault();
      sendCurrentMessage();
    });

    document.getElementById('btn-back-chat-list')?.addEventListener('click', () => {
      showList();
    });

    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  function sendCurrentMessage() {
    const user = DioDB.getCurrentUser();
    const input = document.getElementById('chat-input');
    if (!user || !activeFriendId || !input) return;

    const text = input.value.trim();
    if (!text) return;

    const r = DioDB.sendMessage(user.id, activeFriendId, text);
    if (r.ok) {
      input.value = '';
      renderMessages();
      renderList();
      DioFriends.updateBadges();
      DioUI.haptic();
    } else DioUI.toast(r.error);
  }

  function showList() {
    activeFriendId = null;
    document.getElementById('chat-list-view')?.classList.remove('hidden');
    document.getElementById('chat-room-view')?.classList.add('hidden');
    renderList();
  }

  function openChat(friendId) {
    activeFriendId = friendId;
    const user = DioDB.getCurrentUser();
    const friend = DioDB.getUserById(friendId);
    if (!user || !friend) return;

    DioDB.markMessagesRead(user.id, friendId);
    DioUI.switchTab('chat', DioApp.onTabChange);

    document.getElementById('chat-list-view')?.classList.add('hidden');
    document.getElementById('chat-room-view')?.classList.remove('hidden');
    document.getElementById('chat-friend-name').textContent = friend.name;
    document.getElementById('chat-friend-avatar').textContent = friend.avatar;

    renderMessages();
    DioFriends.updateBadges();
  }

  function renderList() {
    const user = DioDB.getCurrentUser();
    const container = document.getElementById('chat-conversations');
    if (!user || !container) return;

    const convos = DioDB.getConversations(user.id);
    const friends = DioDB.getFriends(user.id);

    if (!friends.length) {
      container.innerHTML = '<p class="text-zinc-500 text-center py-12">Kết bạn trước để nhắn tin!</p>';
      return;
    }

    container.innerHTML = convos.map(c => {
      const preview = c.lastMessage
        ? (c.lastMessage.fromUserId === user.id ? 'Bạn: ' : '') + c.lastMessage.text
        : 'Bắt đầu trò chuyện';
      const time = c.lastMessage
        ? new Date(c.lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '';
      return `
        <button type="button" class="chat-convo-row" data-open-chat="${c.friend.id}">
          <div class="avatar-circle">${c.friend.avatar}</div>
          <div class="flex-1 min-w-0 text-left">
            <div class="flex justify-between">
              <p class="font-semibold truncate">${c.friend.name}</p>
              <span class="text-[10px] text-zinc-500 shrink-0 ml-2">${time}</span>
            </div>
            <p class="text-xs text-zinc-500 truncate">${preview}</p>
          </div>
          ${c.unread ? `<span class="unread-badge">${c.unread}</span>` : ''}
        </button>`;
    }).join('');

    container.querySelectorAll('[data-open-chat]').forEach(btn => {
      btn.addEventListener('click', () => openChat(btn.dataset.openChat));
    });
  }

  function renderMessages() {
    const user = DioDB.getCurrentUser();
    const container = document.getElementById('chat-messages');
    if (!user || !activeFriendId || !container) return;

    const msgs = DioDB.getMessages(user.id, activeFriendId);
    if (!msgs.length) {
      container.innerHTML = '<p class="text-zinc-500 text-center text-sm py-8">Gửi tin nhắn đầu tiên!</p>';
      return;
    }

    container.innerHTML = msgs.map(m => {
      const mine = m.fromUserId === user.id;
      return `
        <div class="chat-bubble-wrap ${mine ? 'mine' : 'theirs'}">
          <div class="chat-bubble">${escapeHtml(m.text)}</div>
          <span class="chat-time">${new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render() {
    if (activeFriendId) renderMessages();
    else {
      showList();
      renderList();
    }
  }

  return { init, render, openChat, showList };
})();