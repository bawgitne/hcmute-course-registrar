const API_BASE = 'https://dangkyapi.hcmute.edu.vn/api/Regist';

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        apiKey: '',
        clientId: '',
        token: '',
        studyProgramId: '',
        turnId: '',
        action: 'CHANGE',
        intervalSeconds: 5,
        courses: []
      },
      runner: { running: false, successCodes: [] },
      logs: []
    });
  }
});

chrome.action.onClicked?.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));

async function updateSettingsFromAuth(authData) {
  const { settings, portalConfig } = await chrome.storage.local.get(['settings', 'portalConfig']);
  const currentSettings = settings || {};
  const currentConfig = portalConfig || {};

  const newConfig = { ...currentConfig, ...authData };
  const newSettings = {
    ...currentSettings,
    token: authData.token || authData.Token || currentSettings.token || '',
    studyProgramId: authData.studyProgramId || currentSettings.studyProgramId || '',
    apiKey: authData.apiKey || currentSettings.apiKey || currentConfig.apiKey || '',
    clientId: authData.clientId || currentSettings.clientId || currentConfig.clientId || '',
    turnId: authData.turnId || currentSettings.turnId || currentConfig.turnId || '',
    action: authData.action || currentSettings.action || currentConfig.action || 'CHANGE',
    year: authData.year || currentSettings.year || currentConfig.year || '2026-2027',
    semester: authData.semester || currentSettings.semester || currentConfig.semester || 'HK01'
  };

  await chrome.storage.local.set({
    portalConfig: newConfig,
    settings: newSettings
  });

  return { portalConfig: newConfig, settings: newSettings };
}

// Lấy cấu hình từ request thật của cổng, không giữ API key/TurnID mặc định.
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.initiator !== 'https://dkmh.hcmute.edu.vn') return;
    if (details.method !== 'POST' || !details.requestBody?.raw?.length) return;
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(details.requestBody.raw[0].bytes);
      const json = JSON.parse(text);
      if (json.ReqParam3 && json.ReqParam4) {
        await updateSettingsFromAuth({
          year: json.ReqParam3,
          semester: json.ReqParam4
        });
      }
    } catch {}
  },
  { urls: ['https://dangkyapi.hcmute.edu.vn/api/Regist/GetAllClassAllowRegist'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    if (details.initiator !== 'https://dkmh.hcmute.edu.vn') return;
    const headers = Object.fromEntries((details.requestHeaders || []).map(h => [h.name.toLowerCase(), h.value || '']));
    const url = new URL(details.url);
    const authorization = headers.authorization || '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const updateData = {};
    if (headers.apikey) updateData.apiKey = headers.apikey;
    if (headers.clientid) updateData.clientId = headers.clientid;
    if (token) updateData.token = token;
    if (url.searchParams.get('TurnID')) updateData.turnId = url.searchParams.get('TurnID');
    if (url.searchParams.get('StudyProgramID')) updateData.studyProgramId = url.searchParams.get('StudyProgramID');
    if (url.searchParams.get('Action')) updateData.action = url.searchParams.get('Action');

    if (Object.keys(updateData).length) {
      await updateSettingsFromAuth(updateData);
    }
  },
  { urls: ['https://dangkyapi.hcmute.edu.vn/*'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'API_REQUEST') {
    apiRequest(message.path, message.body, message.method).then(sendResponse);
    return true;
  }

  if (message.type === 'READ_PORTAL_AUTH') {
    readPortalAuth(message.autoOpen !== false).then(sendResponse);
    return true;
  }

  if (message.type === 'AUTH_CAPTURED') {
    if (message.auth?.config) {
      updateSettingsFromAuth(message.auth.config);
    }
    sendResponse({ ok: true });
    return true;
  }
});

async function checkGooglePopupTabs() {
  const tabs = await chrome.tabs.query({});
  const googleTabs = tabs.filter(t => t.url && t.url.includes('accounts.google.com'));
  for (const gTab of googleTabs) {
    try {
      await chrome.tabs.sendMessage(gTab.id, { type: 'TRIGGER_GOOGLE_SELECT' });
    } catch {}
  }
}

async function readPortalAuth(autoOpen = true) {
  let tabs = await chrome.tabs.query({});
  let tab = tabs.find(t => t.url && t.url.includes('dkmh.hcmute.edu.vn'));

  if (!tab && autoOpen) {
    try {
      tab = await chrome.tabs.create({ url: 'https://dkmh.hcmute.edu.vn/', active: true });
      await waitForTabComplete(tab.id);
    } catch (e) {
      return { ok: false, error: 'Không thể mở tab dkmh.hcmute.edu.vn: ' + e.message };
    }
  }

  if (!tab) {
    return { ok: false, error: 'Chưa kết nối cổng đăng ký. Đã kích hoạt mở tab mới.' };
  }

  // Poll for token up to 10-12s
  const maxAttempts = 7;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let auth = await sendMessageToTab(tab.id, { type: 'READ_AUTH' });

    if (auth?.ok && auth.config?.token) {
      const { portalConfig } = await updateSettingsFromAuth(auth.config);
      return { ...auth, config: { ...(portalConfig || {}), ...(auth.config || {}) } };
    }

    if (autoOpen) {
      const allTabs = await chrome.tabs.query({});
      const googleTabs = allTabs.filter(t => t.url && t.url.includes('accounts.google.com'));
      if (googleTabs.length > 0) {
        await checkGooglePopupTabs();
      } else {
        await sendMessageToTab(tab.id, { type: 'TRIGGER_AUTO_LOGIN' });
      }
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  const { portalConfig, settings } = await chrome.storage.local.get(['portalConfig', 'settings']);
  if (settings?.token) {
    return { ok: true, source: 'storage', config: { ...(portalConfig || {}), token: settings.token } };
  }

  return { ok: false, error: 'Extension đã tự mở tab dkmh.hcmute.edu.vn. Nếu chưa đăng nhập Google, hãy chọn tài khoản trên tab vừa mở.' };
}

function waitForTabComplete(tabId, timeout = 12000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); }
    }, timeout);

    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        if (!done) {
          done = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 800);
        }
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function apiRequest(path, body, method = 'POST') {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.token) return { ok: false, status: 0, error: 'Chưa có Bearer token.' };

  try {
    const options = {
      method,
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        apikey: settings.apiKey,
        clientid: settings.clientId,
        authorization: `Bearer ${settings.token.replace(/^Bearer\s+/i, '').trim()}`
      }
    };
    if (method !== 'GET') options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE}/${path}`, options);
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

