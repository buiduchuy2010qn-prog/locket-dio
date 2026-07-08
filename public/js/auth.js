/**
 * auth.js — Đăng ký / Đăng nhập Locket Dio
 */

const DioAuth = (() => {
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function register(name, email, password, confirm) {
    const displayName = name.trim();
    if (displayName.length < 2) return { ok: false, error: 'Tên hiển thị phải có ít nhất 2 ký tự' };
    if (!validateEmail(email)) return { ok: false, error: 'Email không hợp lệ' };
    if (password.length < 6) return { ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
    if (password !== confirm) return { ok: false, error: 'Mật khẩu xác nhận không khớp' };

    const result = DioDB.registerUser({ name: displayName, email, password });
    if (!result.ok) return result;

    DioDB.setSession(result.user.id);
    return { ok: true, user: result.user };
  }

  function login(email, password) {
    if (!validateEmail(email)) return { ok: false, error: 'Email không hợp lệ' };
    const user = DioDB.getUserByEmail(email);
    if (!user) return { ok: false, error: 'Email hoặc mật khẩu không đúng' };
    if (user.isBanned) return { ok: false, error: 'Tài khoản đã bị khóa' };

    const hash = DioDB.hashPassword(password);
    if (user.password !== hash) return { ok: false, error: 'Email hoặc mật khẩu không đúng' };

    DioDB.setSession(user.id);
    return { ok: true, user: DioDB.sanitizeUser(user) };
  }

  function logout() { DioDB.clearSession(); }

  function isLoggedIn() { return !!DioDB.getCurrentUser(); }

  function restore() { return DioDB.getCurrentUser(); }

  return { register, login, logout, isLoggedIn, restore };
})();