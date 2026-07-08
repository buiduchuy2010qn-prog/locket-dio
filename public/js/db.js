/**
 * db.js — Locket Dio localStorage database
 * Tất cả dữ liệu users, friends, messages, lockets lưu thật trên trình duyệt
 */

const DioDB = (() => {
  const DB_KEY = 'locket_dio_db';
  const SESSION_KEY = 'locket_dio_session';
  const ADMIN_SESSION_KEY = 'locket_dio_admin_session';

  const ADMIN_DEFAULT = {
    email: 'buiduchuy2010qn@gmail.com',
    password: 'duchuy2010',
    name: 'Bùi Đức Huy',
  };

  const defaultDB = () => ({
    users: [],
    friendRequests: [],
    friendships: [],
    messages: [],
    lockets: [],
    settings: { banner: '✦ Chào mừng đến Locket Dio' },
  });

  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultDB(), ...parsed };
      }
    } catch (_) { /* ignore */ }
    const fresh = defaultDB();
    seedAdmin(fresh);
    saveDB(fresh);
    return fresh;
  }

  function saveDB(data = db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage quota exceeded', e);
      throw new Error('Bộ nhớ đầy. Hãy xóa một số Locket cũ trong Admin.');
    }
  }

  function persist() { saveDB(db); }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function hashPassword(pw) {
    return btoa(unescape(encodeURIComponent(`${pw}:locket_dio_salt`)));
  }

  function seedAdmin(data) {
    const exists = data.users.find(u => u.email === ADMIN_DEFAULT.email.toLowerCase());
    if (!exists) {
      data.users.push({
        id: 'admin_1',
        name: ADMIN_DEFAULT.name,
        email: ADMIN_DEFAULT.email.toLowerCase(),
        password: hashPassword(ADMIN_DEFAULT.password),
        avatar: ADMIN_DEFAULT.name.charAt(0).toUpperCase(),
        isAdmin: true,
        isBanned: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // ─── Users ───

  function getUsers() { return db.users; }

  function getUserById(id) {
    return db.users.find(u => u.id === id) || null;
  }

  function getUserByEmail(email) {
    const e = email.trim().toLowerCase();
    return db.users.find(u => u.email === e) || null;
  }

  function registerUser({ name, email, password }) {
    const normalized = email.trim().toLowerCase();
    if (getUserByEmail(normalized)) {
      return { ok: false, error: 'Email đã được đăng ký' };
    }
    const user = {
      id: uid('u'),
      name: name.trim(),
      email: normalized,
      password: hashPassword(password),
      avatar: name.trim().charAt(0).toUpperCase(),
      isAdmin: false,
      isBanned: false,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    persist();
    return { ok: true, user: sanitizeUser(user) };
  }

  function sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
  }

  function isAdminUser(user) {
    if (!user) return false;
    return !!user.isAdmin || user.email === ADMIN_DEFAULT.email.toLowerCase();
  }

  function isCurrentUserAdmin() {
    const user = getCurrentUser();
    if (!user) return false;
    const raw = getUserById(user.id);
    return isAdminUser(raw);
  }

  function toggleBanUser(userId) {
    const u = db.users.find(x => x.id === userId);
    if (u && !u.isAdmin) {
      u.isBanned = !u.isBanned;
      persist();
    }
    return u;
  }

  function deleteUser(userId) {
    db.users = db.users.filter(u => u.id !== userId);
    db.friendRequests = db.friendRequests.filter(r => r.fromUserId !== userId && r.toUserId !== userId);
    db.friendships = db.friendships.filter(f => f.userId1 !== userId && f.userId2 !== userId);
    db.messages = db.messages.filter(m => m.fromUserId !== userId && m.toUserId !== userId);
    db.lockets = db.lockets.filter(l => l.senderId !== userId && !l.recipientIds.includes(userId));
    persist();
  }

  // ─── Session ───

  function setSession(userId) {
    const user = getUserById(userId);
    if (!user) return null;
    const session = { userId: user.id, email: user.email, name: user.name, loggedInAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = getUserById(session.userId);
    if (!user || user.isBanned) {
      clearSession();
      return null;
    }
    return sanitizeUser(user);
  }

  function setAdminSession() {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ loggedInAt: new Date().toISOString() }));
  }

  function isAdminSession() {
    return !!localStorage.getItem(ADMIN_SESSION_KEY);
  }

  function clearAdminSession() { localStorage.removeItem(ADMIN_SESSION_KEY); }

  // ─── Friends ───

  function getFriendshipPair(a, b) {
    return db.friendships.find(f =>
      (f.userId1 === a && f.userId2 === b) || (f.userId1 === b && f.userId2 === a)
    );
  }

  function areFriends(userId1, userId2) {
    return !!getFriendshipPair(userId1, userId2);
  }

  function getPendingRequestBetween(a, b) {
    return db.friendRequests.find(r =>
      r.status === 'pending' &&
      ((r.fromUserId === a && r.toUserId === b) || (r.fromUserId === b && r.toUserId === a))
    );
  }

  function getFriends(userId) {
    return db.friendships
      .filter(f => f.userId1 === userId || f.userId2 === userId)
      .map(f => {
        const friendId = f.userId1 === userId ? f.userId2 : f.userId1;
        return sanitizeUser(getUserById(friendId));
      })
      .filter(Boolean);
  }

  function searchUsers(query, currentUserId) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return db.users
      .filter(u => u.id !== currentUserId && !u.isBanned)
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .map(sanitizeUser)
      .slice(0, 20);
  }

  function sendFriendRequest(fromUserId, toUserId) {
    if (fromUserId === toUserId) return { ok: false, error: 'Không thể kết bạn với chính mình' };
    if (areFriends(fromUserId, toUserId)) return { ok: false, error: 'Đã là bạn bè' };
    if (getPendingRequestBetween(fromUserId, toUserId)) {
      return { ok: false, error: 'Đã gửi lời mời hoặc đang chờ phản hồi' };
    }
    const req = {
      id: uid('fr'),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.friendRequests.push(req);
    persist();
    return { ok: true, request: req };
  }

  function getIncomingRequests(userId) {
    return db.friendRequests
      .filter(r => r.toUserId === userId && r.status === 'pending')
      .map(r => ({ ...r, from: sanitizeUser(getUserById(r.fromUserId)) }));
  }

  function getOutgoingRequests(userId) {
    return db.friendRequests
      .filter(r => r.fromUserId === userId && r.status === 'pending')
      .map(r => ({ ...r, to: sanitizeUser(getUserById(r.toUserId)) }));
  }

  function acceptFriendRequest(requestId, userId) {
    const req = db.friendRequests.find(r => r.id === requestId);
    if (!req || req.toUserId !== userId || req.status !== 'pending') {
      return { ok: false, error: 'Lời mời không hợp lệ' };
    }
    req.status = 'accepted';
    req.respondedAt = new Date().toISOString();
    db.friendships.push({
      id: uid('fs'),
      userId1: req.fromUserId,
      userId2: req.toUserId,
      since: new Date().toISOString(),
    });
    persist();
    return { ok: true };
  }

  function rejectFriendRequest(requestId, userId) {
    const req = db.friendRequests.find(r => r.id === requestId);
    if (!req || req.toUserId !== userId || req.status !== 'pending') {
      return { ok: false, error: 'Lời mời không hợp lệ' };
    }
    req.status = 'rejected';
    req.respondedAt = new Date().toISOString();
    persist();
    return { ok: true };
  }

  function removeFriend(userId, friendId) {
    db.friendships = db.friendships.filter(f =>
      !((f.userId1 === userId && f.userId2 === friendId) || (f.userId1 === friendId && f.userId2 === userId))
    );
    persist();
  }

  // ─── Messages ───

  function convoKey(a, b) {
    return [a, b].sort().join('__');
  }

  function sendMessage(fromUserId, toUserId, text) {
    if (!areFriends(fromUserId, toUserId)) {
      return { ok: false, error: 'Chỉ nhắn tin được với bạn bè' };
    }
    const msg = {
      id: uid('msg'),
      conversationId: convoKey(fromUserId, toUserId),
      fromUserId,
      toUserId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    db.messages.push(msg);
    persist();
    return { ok: true, message: msg };
  }

  function getMessages(userId, friendId) {
    const key = convoKey(userId, friendId);
    return db.messages
      .filter(m => m.conversationId === key)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function markMessagesRead(userId, friendId) {
    const key = convoKey(userId, friendId);
    db.messages.forEach(m => {
      if (m.conversationId === key && m.toUserId === userId) m.read = true;
    });
    persist();
  }

  function getConversations(userId) {
    const friends = getFriends(userId);
    return friends.map(friend => {
      const msgs = getMessages(userId, friend.id);
      const last = msgs[msgs.length - 1] || null;
      const unread = msgs.filter(m => m.toUserId === userId && !m.read).length;
      return { friend, lastMessage: last, unread };
    }).sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt) : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt) : 0;
      return tb - ta;
    });
  }

  // ─── Lockets ───

  function addLocket({ senderId, recipientIds, type, dataUrl, caption }) {
    const locket = {
      id: uid('lk'),
      senderId,
      recipientIds: [...recipientIds],
      type,
      dataUrl,
      caption: caption || '',
      createdAt: new Date().toISOString(),
      viewedBy: [],
    };
    db.lockets.unshift(locket);
    persist();
    return locket;
  }

  function getSentLockets(userId) {
    return db.lockets.filter(l => l.senderId === userId);
  }

  function getReceivedLockets(userId) {
    return db.lockets.filter(l => l.recipientIds.includes(userId));
  }

  function getAllLocketsForUser(userId) {
    const sent = getSentLockets(userId);
    const received = getReceivedLockets(userId);
    const map = new Map();
    [...sent, ...received].forEach(l => map.set(l.id, l));
    return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function markLocketViewed(locketId, userId) {
    const l = db.lockets.find(x => x.id === locketId);
    if (l && !l.viewedBy.includes(userId)) {
      l.viewedBy.push(userId);
      persist();
    }
  }

  function deleteLocket(locketId) {
    db.lockets = db.lockets.filter(l => l.id !== locketId);
    persist();
  }

  function getAllLockets() {
    return [...db.lockets];
  }

  function getStats() {
    return {
      totalUsers: db.users.length,
      totalFriends: db.friendships.length,
      totalMessages: db.messages.length,
      totalLockets: db.lockets.length,
      pendingRequests: db.friendRequests.filter(r => r.status === 'pending').length,
    };
  }

  function getSettings() { return db.settings; }

  function updateSettings(patch) {
    db.settings = { ...db.settings, ...patch };
    persist();
  }

  function reload() { db = load(); }

  return {
    DB_KEY, SESSION_KEY, ADMIN_DEFAULT, hashPassword,
    getUsers, getUserById, getUserByEmail, registerUser, deleteUser, sanitizeUser,
    setSession, getSession, clearSession, getCurrentUser,
    setAdminSession, isAdminSession, clearAdminSession,
    getFriends, searchUsers, sendFriendRequest,
    getIncomingRequests, getOutgoingRequests,
    acceptFriendRequest, rejectFriendRequest, removeFriend, areFriends,
    sendMessage, getMessages, markMessagesRead, getConversations,
    addLocket, getSentLockets, getReceivedLockets, getAllLocketsForUser,
    markLocketViewed, deleteLocket, getAllLockets, getStats, getSettings, updateSettings, reload, persist,
    isAdminUser, isCurrentUserAdmin, toggleBanUser,
  };
})();