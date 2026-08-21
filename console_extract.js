/**
 * HCMUTE Console Extractor - Zero Popups / Zero Alerts
 * Paste vào Console (F12) -> Nhấn Enter -> Copy JSON cấu hình ngay trong Console.
 */
(async function () {
  let token = '';
  let authData = null;

  try {
    const rawAuth = localStorage.getItem('authorizationData');
    if (rawAuth) {
      authData = JSON.parse(rawAuth);
      token = authData.Token || authData.token || '';
    }
  } catch (e) {}

  if (!token) {
    const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i));
      if (val) {
        const match = val.match(jwtPattern);
        if (match) { token = match[0]; break; }
      }
    }
  }

  if (!token) {
    console.error('❌ KHÔNG TÌM THẤY TOKEN! Vui lòng đăng nhập dkmh.hcmute.edu.vn trước.');
    return;
  }

  let userId = authData?.Id || '';
  let userName = authData?.Name || '';
  let studyProgramId = '';

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(decodeURIComponent(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      if (payload.StudyProgramIds) studyProgramId = String(payload.StudyProgramIds).split(',')[0].trim();
      if (!userId && payload.Id) userId = String(payload.Id);
      if (!userName && payload.Name) userName = String(payload.Name);
    }
  } catch (e) {}

  if (!studyProgramId || studyProgramId.length > 6) {
    studyProgramId = (userId && userId.length >= 5) ? userId.substring(0, 5) : '24110';
  }

  let turnId = '81';
  let randId = '0';
  let year = '2026-2027';
  let semester = 'HK01';

  try {
    const res = await fetch(`https://dangkyapi.hcmute.edu.vn/api/Regist/GetRegistSemesterCreditQuota?StudyProgramID=${encodeURIComponent(studyProgramId)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`,
        'apikey': 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv',
        'clientid': 'dtl'
      }
    });

    if (res.ok) {
      const json = await res.json();
      const data = json?.Data || json?.data || json;
      if (data) {
        if (data.IdDot != null) turnId = String(data.IdDot);
        if (data.RandID != null) randId = String(data.RandID);
        if (data.YearStudy) year = String(data.YearStudy);
        if (data.SemesterID) semester = String(data.SemesterID);
      }
    }
  } catch (e) {}

  const config = {
    token: token.replace(/^Bearer\s+/i, '').trim(),
    studyProgramId,
    turnId,
    randId,
    apiKey: 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv',
    clientId: 'dtl',
    year,
    semester,
    action: 'CHANGE',
    userId,
    userName
  };

  const jsonString = JSON.stringify(config, null, 2);

  // Thử gọi hàm copy() bản địa của Chrome DevTools Console
  try {
    if (typeof copy === 'function') copy(jsonString);
  } catch (e) {}

  console.log('%c✅ JSON CẤU HÌNH ĐÃ ĐƯỢC IN BÊN DƯỚI (Bôi đen & Ctrl+C để copy):', 'color: #10b981; font-weight: bold;');
  console.log(jsonString);

  return jsonString;
})();
