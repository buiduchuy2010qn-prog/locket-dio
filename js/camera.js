/**
 * camera.js — Chụp ảnh, quay video 60s, upload, gửi Locket thật
 */

const DioCamera = (() => {
  const MAX_VIDEO_SEC = 60;
  let stream = null;
  let mode = 'photo';
  let facingMode = 'user';
  let usingSample = false;
  let mediaRecorder = null;
  let recordChunks = [];
  let recordTick = null;
  let recordSeconds = 0;
  let captureData = null;
  let selectedRecipients = [];

  const els = {};
  const $ = id => document.getElementById(id);

  function cacheEls() {
    ['camera-video', 'camera-sample', 'capture-preview', 'preview-img', 'preview-video',
     'caption-input', 'caption-count', 'btn-shutter', 'btn-flash', 'btn-flip',
     'btn-retake', 'btn-send', 'btn-recipients', 'library-input', 'flash-overlay',
     'rec-overlay', 'rec-timer', 'camera-friends-strip'
    ].forEach(id => { els[id] = $(id); });
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function startCamera() {
    try {
      if (stream) stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === 'video',
      });
      els['camera-video'].srcObject = stream;
      els['camera-video'].classList.remove('hidden');
      els['camera-sample'].classList.add('hidden');
      usingSample = false;
    } catch (_) {
      usingSample = true;
      els['camera-video'].classList.add('hidden');
      els['camera-sample'].classList.remove('hidden');
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    if (els['camera-video']) els['camera-video'].srcObject = null;
  }

  function compressCanvas(canvas, quality = 0.72, maxW = 800) {
    let { width, height } = canvas;
    if (width > maxW) {
      height = Math.round(height * maxW / width);
      width = maxW;
    }
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d').drawImage(canvas, 0, 0, width, height);
    return c.toDataURL('image/jpeg', quality);
  }

  function takePhoto() {
    const btn = els['btn-shutter'];
    btn?.classList.add('snap');
    setTimeout(() => btn?.classList.remove('snap'), 350);

    if (usingSample) {
      captureData = { type: 'photo', dataUrl: els['camera-sample'].src };
    } else {
      const video = els['camera-video'];
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      captureData = { type: 'photo', dataUrl: compressCanvas(canvas) };
    }

    flash();
    showPreview();
    DioUI.haptic();
  }

  function flash() {
    const el = els['flash-overlay'];
    if (!el) return;
    el.classList.add('flash-active');
    setTimeout(() => el.classList.remove('flash-active'), 280);
  }

  function startRecording() {
    if (usingSample) {
      DioUI.toast('Cần camera thật để quay video');
      return;
    }
    recordChunks = [];
    recordSeconds = 0;
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (_) {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = e => { if (e.data.size) recordChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordChunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        captureData = { type: 'video', dataUrl: reader.result };
        showPreview();
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start(200);
    els['btn-shutter']?.classList.add('recording');
    els['rec-overlay']?.classList.remove('hidden');
    updateRecTimer();

    recordTick = setInterval(() => {
      recordSeconds++;
      updateRecTimer();
      if (recordSeconds >= MAX_VIDEO_SEC) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    clearInterval(recordTick);
    recordTick = null;
    els['btn-shutter']?.classList.remove('recording');
    els['rec-overlay']?.classList.add('hidden');
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    mediaRecorder = null;
  }

  function updateRecTimer() {
    const el = els['rec-timer'];
    if (el) el.textContent = `${fmtTime(recordSeconds)} / ${fmtTime(MAX_VIDEO_SEC)}`;
  }

  function showPreview() {
    els['capture-preview']?.classList.remove('hidden');
    const img = els['preview-img'];
    const vid = els['preview-video'];
    if (captureData.type === 'photo') {
      img.src = captureData.dataUrl;
      img.classList.remove('hidden');
      vid.classList.add('hidden');
    } else {
      vid.src = captureData.dataUrl;
      vid.classList.remove('hidden');
      img.classList.add('hidden');
    }
    els['caption-input'].value = '';
    updateCaptionCount();
  }

  function hidePreview() {
    els['capture-preview']?.classList.add('hidden');
    captureData = null;
  }

  function updateCaptionCount() {
    const input = els['caption-input'];
    const count = els['caption-count'];
    if (input && count) count.textContent = `${input.value.length}/300`;
  }

  function sendLocket() {
    const user = DioDB.getCurrentUser();
    if (!user || !captureData) return;

    const friends = DioDB.getFriends(user.id);
    if (!friends.length) {
      DioUI.toast('Hãy kết bạn trước khi gửi Locket');
      return;
    }

    const recipients = selectedRecipients.length ? selectedRecipients : friends.map(f => f.id);
    const caption = els['caption-input']?.value.trim() || '';

    try {
      DioDB.addLocket({
        senderId: user.id,
        recipientIds: recipients,
        type: captureData.type,
        dataUrl: captureData.dataUrl,
        caption,
      });
    } catch (e) {
      DioUI.toast(e.message || 'Không thể lưu Locket');
      return;
    }

    hidePreview();
    DioUI.emojiRain();
    DioUI.toast('Đã gửi Locket! ✦');
    DioUI.haptic();
    DioHistory.render();
    renderFriendStrip();
  }

  function renderFriendStrip() {
    const user = DioDB.getCurrentUser();
    if (!user) return;

    const friends = DioDB.getFriends(user.id);
    const received = DioDB.getReceivedLockets(user.id);

    const html = friends.map(f => {
      const hasNew = received.some(l => l.senderId === f.id && !l.viewedBy.includes(user.id));
      return `
        <button type="button" class="friend-strip-btn" data-friend="${f.id}">
          <div class="friend-strip-ring ${hasNew ? 'has-new' : ''}">
            <span class="avatar-circle sm">${f.avatar}</span>
          </div>
          <span class="friend-strip-name">${f.name.split(' ').pop()}</span>
        </button>`;
    }).join('') || '<span class="text-xs text-zinc-500">Chưa có bạn bè</span>';

    ['camera-friends-strip', 'camera-friends-strip-desktop'].forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      container.innerHTML = html;
      container.querySelectorAll('[data-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
          const lockets = received.filter(l => l.senderId === btn.dataset.friend);
          if (lockets.length) {
            DioDB.markLocketViewed(lockets[0].id, user.id);
            DioHistory.openDetail(lockets[0].id);
            renderFriendStrip();
          }
        });
      });
    });
  }

  function populateRecipients() {
    const user = DioDB.getCurrentUser();
    const list = document.getElementById('recipient-list');
    if (!user || !list) return;

    const friends = DioDB.getFriends(user.id);
    list.innerHTML = friends.map(f => `
      <label class="recipient-row">
        <input type="checkbox" value="${f.id}" ${!selectedRecipients.length || selectedRecipients.includes(f.id) ? 'checked' : ''}>
        <div class="avatar-circle sm">${f.avatar}</div>
        <span>${f.name}</span>
      </label>
    `).join('');
  }

  function updateRecipientLabel() {
    const user = DioDB.getCurrentUser();
    const friends = DioDB.getFriends(user.id);
    const btn = els['btn-recipients'];
    if (!btn) return;
    if (!selectedRecipients.length || selectedRecipients.length === friends.length) {
      btn.textContent = 'Gửi cho: Tất cả bạn bè ▾';
    } else {
      btn.textContent = `Gửi cho: ${selectedRecipients.length} người ▾`;
    }
  }

  function init() {
    cacheEls();
    selectedRecipients = [];

    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
        els['btn-shutter']?.classList.toggle('video-mode', mode === 'video');
      });
    });

    els['btn-shutter']?.addEventListener('click', () => {
      if (mode === 'photo') takePhoto();
      else if (mediaRecorder?.state === 'recording') stopRecording();
      else startRecording();
    });

    els['btn-retake']?.addEventListener('click', hidePreview);
    els['btn-send']?.addEventListener('click', sendLocket);
    els['caption-input']?.addEventListener('input', updateCaptionCount);

    els['btn-flip']?.addEventListener('click', () => {
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      startCamera();
    });

    els['library-input']?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        captureData = {
          type: file.type.startsWith('video') ? 'video' : 'photo',
          dataUrl: reader.result,
        };
        showPreview();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    els['btn-recipients']?.addEventListener('click', () => {
      populateRecipients();
      DioUI.openModal('modal-recipients');
    });

    document.getElementById('btn-confirm-recipients')?.addEventListener('click', () => {
      const checked = [...document.querySelectorAll('#recipient-list input:checked')].map(c => c.value);
      const friends = DioDB.getFriends(DioDB.getCurrentUser()?.id || '');
      selectedRecipients = checked.length === friends.length ? [] : checked;
      updateRecipientLabel();
      DioUI.closeModal('modal-recipients');
    });

    renderFriendStrip();
  }

  function onTabActive() { startCamera(); renderFriendStrip(); }
  function onTabLeave() { stopRecording(); stopCamera(); }

  return { init, onTabActive, onTabLeave, renderFriendStrip };
})();