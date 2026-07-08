/**
 * app.js — Bootstrap Locket Dio (sau đăng nhập)
 */

const DioApp = (() => {
  let booted = false;

  function onTabChange(tab) {
    if (tab === 'camera') DioCamera.onTabActive();
    else DioCamera.onTabLeave();

    if (tab === 'friends') DioFriends.render();
    if (tab === 'chat') DioChat.render();
    if (tab === 'history') DioHistory.render();
    if (tab === 'profile') DioProfile.render();

    DioFriends.updateBadges();
  }

  function refresh() {
    DioFriends.render();
    DioChat.showList();
    DioHistory.render();
    DioProfile.render();
    DioCamera.renderFriendStrip();
    DioFriends.updateBadges();
  }

  function boot() {
    if (booted) return;
    booted = true;

    const settings = DioDB.getSettings();
    const banner = document.getElementById('system-banner');
    if (settings.banner && banner) {
      banner.textContent = settings.banner;
      banner.classList.remove('hidden');
    }

    DioUI.initModals();
    DioUI.initTabs(onTabChange);

    DioCamera.init();
    DioFriends.init();
    DioChat.init();
    DioHistory.init();
    DioProfile.init();

    refresh();
    DioCamera.onTabActive();

    console.log('Locket Dio ready ✦');
  }

  return { boot, refresh, onTabChange };
})();