function readAuth() {
  const candidates = [];
  let authorizationData = null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (value) {
      candidates.push([key, value]);
      if (key === 'authorizationData') {
        try { authorizationData = JSON.parse(value); } catch { /* dữ liệu không phải JSON */ }
      }
    }
  }
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    if (value) candidates.push([key, value]);
  }

  const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  for (const [key, value] of candidates) {
    const match = value.match(jwtPattern);
    if (match) {
      const token = authorizationData?.Token || match[0];
      let studyProgramId = '';
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        studyProgramId = String(payload.StudyProgramIds || '').split(',')[0].trim();
      } catch { /* JWT không đọc được */ }
      const domProgram = document.querySelector('input.MuiSelect-nativeInput')?.value || '';
      let year = '';
      let semester = '';
      try {
        const text = document.body?.innerText || '';
        const m = text.match(/Năm\s+học\s+([0-9]{4}-[0-9]{4})\s*-\s*Học\s+kỳ\s+([A-Z0-9]+)/i);
        if (m) { year = m[1]; semester = m[2]; }
      } catch {}
      return {
        ok: true,
        token,
        source: key,
        config: {
          token,
          studyProgramId: domProgram || studyProgramId,
          userId: authorizationData?.Id || '',
          expiresAt: authorizationData?.Expire || '',
          year,
          semester
        }
      };
    }
  }
  return { ok: false, error: 'Không tìm thấy token trong bộ nhớ của trang.' };
}

function simulateFullClick(element) {
  if (!element) return;
  try { element.focus(); } catch {}
  try { element.click(); } catch {}
  try {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(evt);
  } catch {}
}

function findGoogleLoginButton() {
  // Direct match: button inside <form>
  const formBtn = document.querySelector('form button:not([aria-label="Settings"]):not(.MuiFab-root)');
  if (formBtn) return formBtn;

  // Search all non-Settings buttons for Google text or 4-color SVG
  const buttons = Array.from(document.querySelectorAll('button:not([aria-label="Settings"]):not(.MuiFab-root), div[role="button"]:not(.MuiFab-root)'));
  
  for (const btn of buttons) {
    const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
    if (text.includes('google') || text.includes('đăng nhập với google')) {
      return btn;
    }
    const svgPaths = Array.from(btn.querySelectorAll('svg path'));
    for (const path of svgPaths) {
      const fill = (path.getAttribute('fill') || '').trim();
      if (['#EA4335', '#34A853', '#4A90E2', '#FBBC05'].includes(fill)) {
        return btn;
      }
    }
  }

  return null;
}

let lastAttempt = 0;

function tryAutoGoogleLogin() {
  const auth = readAuth();
  if (auth.ok) return false;

  const now = Date.now();
  if (now - lastAttempt < 1500) return false;

  const btn = findGoogleLoginButton();
  if (btn) {
    lastAttempt = now;
    console.log('[HCMUTE Extension] Thực hiện click nút Đăng nhập Google:', btn);
    simulateFullClick(btn);
    return true;
  }
  return false;
}

function checkAndNotifyAuth() {
  const auth = readAuth();
  if (auth.ok) {
    chrome.runtime.sendMessage({ type: 'AUTH_CAPTURED', auth }).catch(() => {});
  } else {
    tryAutoGoogleLogin();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'READ_AUTH') {
    const auth = readAuth();
    if (!auth.ok) {
      tryAutoGoogleLogin();
    }
    sendResponse(auth);
    return;
  }
  if (message.type === 'TRIGGER_AUTO_LOGIN') {
    const clicked = tryAutoGoogleLogin();
    sendResponse({ ok: clicked });
    return;
  }
});

// Run immediate and recurring checks
let pollCounter = 0;
let pollInterval = null;
pollInterval = setInterval(() => {
  pollCounter++;
  checkAndNotifyAuth();
  if (pollCounter > 25) {
    if (pollInterval) clearInterval(pollInterval);
  }
}, 500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => checkAndNotifyAuth());
} else {
  checkAndNotifyAuth();
}

const observer = new MutationObserver(() => {
  checkAndNotifyAuth();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  });
}



