const $ = (id) => document.getElementById(id);
let timer = null;
let busy = false;
let state = { settings: null, runner: { running: false, successCodes: [], nextIndex: 0 }, logs: [], statuses: {}, registered: [], available: {} };

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const stored = await chrome.storage.local.get(['settings', 'runner', 'logs', 'statuses']);
  state.settings = stored.settings || {};
  state.runner = stored.runner || { running: false, successCodes: [] };
  state.logs = stored.logs || [];
  state.statuses = stored.statuses || {};
  fillForm();
  bindEvents();
  render();
  await syncAuth(true);
  // A dashboard tab intentionally owns the 5-second timer: MV3 service workers
  // cannot guarantee alarms below 30 seconds.
  if (state.runner.running) startTimer(false);
}

function bindEvents() {
  $('settingsForm').addEventListener('submit', async (event) => { event.preventDefault(); await saveSettings(); flash('Đã lưu cấu hình.'); });
  $('courses').addEventListener('input', () => $('courseCount').textContent = `${parseCourses().length} lớp`);
  $('start').addEventListener('click', start);
  $('stop').addEventListener('click', stop);
  $('runOnce').addEventListener('click', async () => { if (await saveSettings()) await runCycle(); });
  $('clearLogs').addEventListener('click', async () => { state.logs = []; await chrome.storage.local.set({ logs: [] }); renderLogs(); });
  $('readAuth').addEventListener('click', () => syncAuth(false));
  $('loadRegistered').addEventListener('click', () => loadCourses('registered'));
  $('loadAllowRegistKH')?.addEventListener('click', () => loadCourses('KH'));
  $('loadAllowRegistNKH')?.addEventListener('click', () => loadCourses('NKH'));
  $('registeredCourses').addEventListener('click', handleRegisteredClick);
  window.addEventListener('beforeunload', () => clearTimeout(timer));

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;
    if (changes.settings?.newValue) {
      state.settings = { ...state.settings, ...(changes.settings.newValue || {}) };
      fillForm();
      renderStatuses();
    }
    if (changes.portalConfig?.newValue || changes.settings?.newValue) {
      const config = changes.portalConfig?.newValue || {};
      const s = state.settings || {};
      const hasToken = Boolean(s.token);
      const missing = [
        ['API key', s.apiKey], ['Client ID', s.clientId],
        ['TurnID', s.turnId], ['StudyProgramID', s.studyProgramId]
      ].filter(([, value]) => !value).map(([name]) => name);
      setAuthStatus(hasToken, config.userId || '', config.expiresAt || '', missing);
    }
  });
}

function fillForm() {
  for (const key of ['token','studyProgramId','turnId','action','clientId','apiKey','year','semester','intervalSeconds']) {
    if ($(key) && state.settings[key] != null) $(key).value = state.settings[key];
  }
  $('courses').value = (state.settings.courses || []).join('\n');
  $('courseCount').textContent = `${parseCourses().length} lớp`;
}

function parseCourses() {
  return [...new Set($('courses').value.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean))];
}

async function saveSettings() {
  if (!$('turnId').value) await discoverTurnId();
  const settings = {
    ...state.settings,
    token: $('token').value.replace(/^Bearer\s+/i, '').trim(),
    studyProgramId: $('studyProgramId').value.trim(),
    turnId: $('turnId').value.trim(),
    action: $('action').value,
    clientId: $('clientId').value.trim(),
    apiKey: $('apiKey').value.trim(),
    year: ($('year')?.value || state.settings.year || '2026-2027').trim(),
    semester: ($('semester')?.value || state.settings.semester || 'HK01').trim(),
    intervalSeconds: Math.max(5, Number($('intervalSeconds').value) || 5),
    courses: parseCourses()
  };
  if (!settings.token || !settings.studyProgramId || !settings.turnId || !settings.apiKey || !settings.courses.length) {
    const missing = [];
    if (!settings.token) missing.push('phiên đăng nhập');
    if (!settings.studyProgramId) missing.push('chương trình đào tạo');
    if (!settings.turnId) missing.push('đợt đăng ký (TurnID)');
    if (!settings.apiKey) missing.push('cấu hình API');
    if (!settings.courses.length) missing.push('mã lớp');
    flash(`Chưa có ${missing.join(', ')}. TurnID được lấy tự động từ cổng, không cần nhập.`, true);
    return false;
  }
  state.settings = settings;
  await chrome.storage.local.set({ settings });
  renderStatuses();
  return true;
}

function setAuthConnecting(msg = 'Đang tự động mở tab & lấy phiên đăng nhập...') {
  const box = $('authStatus');
  if (!box) return;
  box.className = 'auth-status connecting';
  box.innerHTML = `<span></span><div><strong>${escapeHtml(msg)}</strong><small>Extension đang kết nối tab dkmh.hcmute.edu.vn và tự động đăng nhập Google...</small></div>`;
}

async function syncAuth(silent = false) {
  setAuthConnecting();
  const result = await chrome.runtime.sendMessage({ type: 'READ_PORTAL_AUTH', autoOpen: true });
  if (result?.ok) {
    const config = result.config || {};
    for (const [id, value] of Object.entries({
      token: config.token || result.token,
      studyProgramId: config.studyProgramId,
      turnId: config.turnId,
      action: config.action,
      clientId: config.clientId,
      apiKey: config.apiKey,
      year: config.year,
      semester: config.semester
    })) if ($(id) && value) $(id).value = value;
    state.settings = {
      ...state.settings,
      token: $('token').value,
      studyProgramId: $('studyProgramId').value,
      apiKey: $('apiKey').value,
      clientId: $('clientId').value,
      turnId: $('turnId').value,
      action: $('action').value,
      year: $('year')?.value || '2026-2027',
      semester: $('semester')?.value || 'HK01'
    };
    await chrome.storage.local.set({ settings: state.settings });
    if (!$('turnId').value && $('studyProgramId').value) await discoverTurnId();
    const missing = [
      ['API key', $('apiKey').value], ['Client ID', $('clientId').value],
      ['TurnID', $('turnId').value], ['StudyProgramID', $('studyProgramId').value]
    ].filter(([, value]) => !value).map(([name]) => name);
    setAuthStatus(true, config.userId, config.expiresAt, missing);
    if (!silent || missing.length) flash(missing.length
      ? `Đã tự động lấy phiên đăng nhập nhưng còn thiếu ${missing.join(', ')}.`
      : `Đã tự động kết nối và lấy thành công phiên đăng nhập từ cổng!`, missing.length > 0);
  } else {
    const { settings } = await chrome.storage.local.get('settings');
    const hasToken = Boolean(settings?.token);
    setAuthStatus(hasToken, '', '', hasToken ? [] : ['phiên đăng nhập']);
    if (!silent) flash(result?.error || 'Đã tự mở tab dkmh.hcmute.edu.vn. Vui lòng kiểm tra tab mới mở.', true);
  }
}

function setAuthStatus(ok, userId = '', expiresAt = '', missing = []) {
  const box = $('authStatus');
  if (!box) return;
  box.className = `auth-status ${ok ? 'ready' : 'error'}`;
  if (!ok) {
    box.innerHTML = '<span></span><div><strong>Chưa lấy được phiên đăng nhập</strong><small>Extension đang tự động thử lại hoặc vui lòng chọn tài khoản trên tab dkmh.hcmute.edu.vn mới mở.</small></div>';
    return;
  }
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString('vi-VN') : 'không rõ';
  const detail = missing.length ? `Thiếu cấu hình request: ${missing.join(', ')}` : `MSSV ${userId || '—'} · Hết hạn ${expiry}`;
  box.innerHTML = `<span></span><div><strong>Đã tự lấy phiên đăng nhập</strong><small>${escapeHtml(detail)}</small></div>`;
}

async function discoverTurnId() {
  const studyProgramId = $('studyProgramId').value.trim();
  if (!studyProgramId || !$('token').value || !$('apiKey').value) return false;
  const result = await request(`GetRegistSemesterCreditQuota?StudyProgramID=${encodeURIComponent(studyProgramId)}`, undefined, 'GET');
  if (!result?.ok) return false;
  const data = result.data?.Data || result.data?.data || result.data;
  const turnId = data?.IdDot ?? data?.idDot ?? data?.TurnID ?? data?.turnId;
  if (turnId == null || turnId === '') return false;
  $('turnId').value = String(turnId);
  state.settings.turnId = String(turnId);
  state.settings.randId = String(data?.RandID ?? data?.randId ?? data?.RandId ?? 0);
  if (data?.YearStudy) {
    state.settings.year = String(data.YearStudy);
    if ($('year')) $('year').value = String(data.YearStudy);
  }
  if (data?.SemesterID || data?.SemesterId) {
    const sem = String(data.SemesterID || data.SemesterId);
    state.settings.semester = sem;
    if ($('semester')) $('semester').value = sem;
  }
  await chrome.storage.local.set({ settings: state.settings });
  return true;
}

function setAuthStatus(ok, userId = '', expiresAt = '', missing = []) {
  const box = $('authStatus');
  box.className = `auth-status ${ok ? 'ready' : 'error'}`;
  if (!ok) {
    box.innerHTML = '<span></span><div><strong>Chưa kết nối cổng đăng ký</strong><small>Hãy mở, đăng nhập và tải lại trang dkmh.hcmute.edu.vn.</small></div>';
    return;
  }
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString('vi-VN') : 'không rõ';
  const detail = missing.length ? `Thiếu cấu hình request: ${missing.join(', ')}` : `MSSV ${userId || '—'} · Hết hạn ${expiry}`;
  box.innerHTML = `<span></span><div><strong>Đã tự lấy phiên đăng nhập</strong><small>${escapeHtml(detail)}</small></div>`;
}

async function start() {
  if (!(await saveSettings())) return;
  state.runner.running = true;
  await chrome.storage.local.set({ runner: state.runner });
  startTimer(true);
  renderRunState();
}

function startTimer(runNow) {
  clearTimeout(timer);
  const loop = async () => {
    if (!state.runner.running) return;
    await runCycle();
    timer = setTimeout(loop, state.settings.intervalSeconds * 1000);
  };
  if (runNow) loop(); else timer = setTimeout(loop, state.settings.intervalSeconds * 1000);
}

async function stop() {
  state.runner.running = false;
  clearTimeout(timer);
  await chrome.storage.local.set({ runner: state.runner });
  renderRunState();
  flash('Đã dừng gửi yêu cầu.');
}

async function runCycle() {
  if (busy) return;
  busy = true;
  try {
    const pending = state.settings.courses.filter(code => !state.runner.successCodes.includes(code));
    if (!pending.length) return;
    const index = (state.runner.nextIndex || 0) % pending.length;
    const code = pending[index];
    state.runner.nextIndex = (index + 1) % pending.length;
    state.statuses[code] = { label: 'Đang xử lý', kind: 'working', at: Date.now() };
    renderStatuses();
    await processCourse(code);
  } finally {
    busy = false;
    await chrome.storage.local.set({ statuses: state.statuses, runner: state.runner });
    render();
  }
}

async function loadCourses(mode = 'registered') {
  await syncAuth(true);
  const required = [$('token').value, $('apiKey').value, $('studyProgramId').value, $('turnId').value];
  if (required.some(value => !value)) {
    flash('Chưa đồng bộ đủ phiên đăng nhập, API key, chương trình hoặc đợt đăng ký.', true);
    return;
  }
  state.settings = {
    ...state.settings,
    token: $('token').value,
    apiKey: $('apiKey').value,
    clientId: $('clientId').value,
    studyProgramId: $('studyProgramId').value,
    turnId: $('turnId').value,
    year: ($('year')?.value || state.settings.year || '2026-2027').trim(),
    semester: ($('semester')?.value || state.settings.semester || 'HK01').trim()
  };
  await chrome.storage.local.set({ settings: state.settings });

  const labels = {
    registered: 'Môn đã đăng ký',
    KH: 'Môn theo kế hoạch',
    NKH: 'Môn ngoài kế hoạch'
  };

  $('registeredCourses').innerHTML = `<div class="empty">Đang tải ${labels[mode] || 'danh sách môn'}…</div>`;

  let result;
  if (mode === 'registered') {
    const body = {
      ReqParam1: String(state.settings.randId || 0),
      ReqParam2: String(state.settings.turnId)
    };
    result = await request('GetAllClassRegisted', body);
  } else {
    const year = state.settings.year || '2026-2027';
    const semester = state.settings.semester || 'HK01';
    const body = {
      ReqParam1: String(state.settings.studyProgramId),
      ReqParam2: mode,
      ReqParam3: year,
      ReqParam4: semester,
      ReqParam5: ''
    };
    result = await request('GetAllClassAllowRegist', body);
  }

  addLog('—', labels[mode] || 'Môn học', result);
  if (!result.ok || isBusinessFailure(result.data)) {
    const msg = responseMessage(result);
    $('registeredCourses').innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
    return;
  }

  state.courseMode = mode;
  state.registered = unwrapArray(result.data);
  if (!state.registered.length) {
    const msg = responseMessage(result);
    const detail = (msg && !msg.startsWith('{') && !msg.startsWith('HTTP')) ? msg : 'API trả về danh sách môn rỗng.';
    $('registeredCourses').innerHTML = `<div class="empty">${escapeHtml(detail)}</div>`;
    return;
  }
  renderRegisteredCourses();
}

function renderRegisteredCourses() {
  if (!state.registered.length) {
    $('registeredCourses').innerHTML = '<div class="empty">API không trả về môn nào.</div>';
    return;
  }
  $('registeredCourses').innerHTML = state.registered.map((item, index) => {
    const key = registeredKey(item, index);
    const options = state.available[key];
    const subjectCode = extractSubjectCode(item);
    const isRegisted = item.IsRegisted === true || state.courseMode === 'registered';
    const tagHtml = isRegisted
      ? '<span class="pill success" style="font-size:10px;padding:2px 6px;margin-left:6px;">Đã đăng ký</span>'
      : '<span class="pill working" style="font-size:10px;padding:2px 6px;margin-left:6px;">Chưa đăng ký</span>';

    return `<article class="registered-item">
      <div class="registered-head">
        <div>
          <div class="course-code">${escapeHtml(item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID || subjectCode || 'Môn học')}${tagHtml}</div>
          <div class="course-meta">${escapeHtml(classSummary(item))}</div>
        </div>
        <button class="ghost" data-show-classes="${escapeHtml(key)}">${options ? 'Tải lại lớp' : 'Hiện các lớp'}</button>
      </div>
      ${options ? renderAvailableOptions(options, subjectCode) : ''}
    </article>`;
  }).join('');
}

function renderAvailableOptions(items, subjectCode) {
  if (!items.length) return '<div class="empty compact">Không có lớp phù hợp.</div>';
  const targetClasses = state.settings.targetClasses || {};
  const selectedForSubject = targetClasses[subjectCode] || [];

  const headBar = subjectCode ? `<div class="available-head-bar">
    <div>Tick chọn các lớp muốn theo dõi của môn <strong>${escapeHtml(subjectCode)}</strong>:</div>
    <button type="button" class="primary" data-add-subject="${escapeHtml(subjectCode)}">+ Thêm môn ${escapeHtml(subjectCode)}</button>
  </div>` : '';

  const rows = items.map(item => {
    const code = item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID;
    const isReg = item.IsRegisted === true;
    const current = item.NumberOfStudents != null ? Number(item.NumberOfStudents) : null;
    const max = item.MaxStudentNumber != null ? Number(item.MaxStudentNumber) : null;
    const isFull = current != null && max != null && max > 0 && current >= max;
    const isChecked = selectedForSubject.length === 0 || selectedForSubject.includes(code);

    let seatBadge = '';
    if (current != null && max != null) {
      if (isFull) {
        seatBadge = `<span class="pill error" style="font-size:10px;padding:2px 6px;margin-left:6px;">Đã đầy (${current}/${max})</span>`;
      } else {
        seatBadge = `<span class="pill success" style="font-size:10px;padding:2px 6px;margin-left:6px;">Còn ${max - current} chỗ (${current}/${max})</span>`;
      }
    }

    return `<div class="available-row">
      <div class="available-row-left">
        ${code ? `<input type="checkbox" class="class-target-cb" data-subject="${escapeHtml(subjectCode)}" data-class-code="${escapeHtml(code)}" ${isChecked ? 'checked' : ''} ${isReg ? 'disabled' : ''}>` : ''}
        <div>
          <strong>${escapeHtml(code || 'Không rõ mã')}${seatBadge}</strong>
          <small>${escapeHtml(classSummary(item))}</small>
        </div>
      </div>
      <button class="${isReg ? 'ghost' : 'secondary'}" data-add-change="${escapeHtml(code || '')}" ${isReg ? 'disabled' : ''}>
        ${isReg ? 'Đang học' : 'Thêm riêng lớp này'}
      </button>
    </div>`;
  }).join('');

  return `<div class="available-list">${headBar}${rows}</div>`;
}

function extractSubjectCode(item) {
  if (!item) return '';
  if (typeof item === 'string') return cleanSubjectCode(item);
  
  if (item.StudyUnitID != null && String(item.StudyUnitID).trim() !== '') {
    return cleanSubjectCode(item.StudyUnitID);
  }
  if (item.CurriculumID != null && String(item.CurriculumID).trim() !== '') {
    return cleanSubjectCode(item.CurriculumID);
  }
  if (item.ScheduleStudyUnitAlias != null && String(item.ScheduleStudyUnitAlias).trim() !== '') {
    return cleanSubjectCode(item.ScheduleStudyUnitAlias);
  }

  const candidates = [
    item.ScheduleStudyUnitID,
    item.SubjectID,
    item.SubjectCode,
    item.CurriculumCode,
    item.StudyUnitCode,
    item.Code,
    item.code,
    item.Id,
    item.id
  ];

  for (const candidate of candidates) {
    if (candidate != null && String(candidate).trim() !== '') {
      const cleaned = cleanSubjectCode(candidate);
      if (cleaned) return cleaned;
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (val != null && typeof val === 'string' && /ID|Code|Alias|Ma/i.test(key)) {
      const cleaned = cleanSubjectCode(val);
      if (cleaned) return cleaned;
    }
  }

  return '';
}

function cleanSubjectCode(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/_.*$/, '');
  return str;
}

function registeredKey(item, index) {
  const code = extractSubjectCode(item) || 'course';
  return `${code}:${index}`;
}

async function fetchSubjectClasses(rawCode, studyProgramId, typeRegist) {
  const searchCode = cleanSubjectCode(rawCode);
  
  const codeVariants = [searchCode];
  if (/^\d{3}[A-Z]{2,5}\d+/i.test(searchCode)) {
    const noPrefix = searchCode.replace(/^\d{3}/, '');
    if (!codeVariants.includes(noPrefix)) codeVariants.push(noPrefix);
  } else if (/^[A-Z]{2,5}\d+/i.test(searchCode)) {
    const withPrefix = `261${searchCode}`;
    if (!codeVariants.includes(withPrefix)) codeVariants.push(withPrefix);
  }

  const modeVariants = [typeRegist, typeRegist === 'NKH' ? 'KH' : 'NKH'];

  let lastSearch = null;

  for (const mode of modeVariants) {
    for (const reqCode of codeVariants) {
      const search = await request('GetAllScheduleUnitAllowRegist', {
        ReqParam1: studyProgramId,
        ReqParam2: mode,
        ReqParam3: reqCode
      });
      lastSearch = search;
      if (search.ok && !isBusinessFailure(search.data)) {
        const classes = unwrapArray(search.data);
        if (classes.length > 0) {
          return { ok: true, search, classes, matchedCode: reqCode, matchedMode: mode };
        }
      }
    }
  }

  return { ok: Boolean(lastSearch?.ok), search: lastSearch, classes: [], matchedCode: searchCode, matchedMode: typeRegist };
}

async function handleRegisteredClick(event) {
  // Checkbox toggle: chọn / bỏ chọn lớp cần theo dõi của môn
  if (event.target.classList.contains('class-target-cb')) {
    const cb = event.target;
    const subject = cb.dataset.subject;
    const classCode = cb.dataset.classCode;
    if (!subject || !classCode) return;

    const targetClasses = { ...(state.settings.targetClasses || {}) };
    let currentTargets = targetClasses[subject] || [];

    if (cb.checked) {
      if (!currentTargets.includes(classCode)) currentTargets.push(classCode);
    } else {
      currentTargets = currentTargets.filter(c => c !== classCode);
    }
    targetClasses[subject] = currentTargets;

    // Đảm bảo mã môn học có trong hàng đợi Bước 02
    const courses = new Set(parseCourses());
    courses.add(subject);
    $('courses').value = [...courses].join('\n');
    $('courseCount').textContent = `${courses.size} môn/lớp`;

    state.settings = { ...state.settings, courses: [...courses], targetClasses };
    await chrome.storage.local.set({ settings: state.settings });
    flash(`Đã cập nhật các lớp cần theo dõi cho môn ${subject} (${currentTargets.length ? currentTargets.length + ' lớp' : 'tất cả lớp'}).`);
    return;
  }

  // Nút thêm toàn bộ môn vào hàng đợi Bước 02
  const addSubjectBtn = event.target.closest('[data-add-subject]');
  if (addSubjectBtn) {
    const subject = addSubjectBtn.dataset.addSubject;
    if (!subject) return;
    const courses = new Set(parseCourses());
    courses.add(subject);
    $('courses').value = [...courses].join('\n');
    $('courseCount').textContent = `${courses.size} môn/lớp`;
    state.settings = { ...state.settings, courses: [...courses] };
    await chrome.storage.local.set({ settings: state.settings });
    state.statuses[subject] = { label: 'Chờ theo dõi', kind: '', message: `Đã thêm môn ${subject} vào hàng đợi.`, at: Date.now() };
    await chrome.storage.local.set({ statuses: state.statuses });
    renderStatuses();
    flash(`Đã thêm môn ${subject} vào hàng đợi theo dõi 5s.`);
    return;
  }

  const showButton = event.target.closest('[data-show-classes]');
  if (showButton) {
    const key = showButton.dataset.showClasses;
    const index = Number(key.split(':').pop());
    const item = state.registered[index];
    if (!item) {
      flash('Không tìm thấy dữ liệu môn học. Hãy tải lại danh sách.', true);
      return;
    }
    showButton.disabled = true;
    showButton.textContent = 'Đang tải…';
    const studyUnitId = extractSubjectCode(item);
    const typeRegist = item.TypeRegist || (state.courseMode === 'NKH' ? 'NKH' : 'KH');
    const studyProgramId = state.settings.studyProgramId;

    if (!studyProgramId || !typeRegist || !studyUnitId) {
      const missing = [];
      if (!studyProgramId) missing.push('StudyProgramID (ReqParam1)');
      if (!typeRegist) missing.push('Loại đăng ký (ReqParam2)');
      if (!studyUnitId) missing.push('Mã môn học (ReqParam3)');
      flash(`Thiếu tham số bắt buộc: ${missing.join(', ')}.`, true);
      showButton.disabled = false;
      showButton.textContent = 'Hiện các lớp';
      return;
    }

    const { ok, search, classes, matchedCode, matchedMode } = await fetchSubjectClasses(studyUnitId, studyProgramId, typeRegist);

    addLog(studyUnitId, 'Các lớp học phần', search);
    state.available[key] = classes;
    renderRegisteredCourses();
    return;
  }

  const addButton = event.target.closest('[data-add-change]');
  if (addButton) {
    const code = addButton.dataset.addChange;
    if (!code) return;
    const courses = new Set(parseCourses());
    courses.add(code);
    $('courses').value = [...courses].join('\n');
    $('courseCount').textContent = `${courses.size} môn/lớp`;
    state.settings = {
      ...state.settings,
      courses: [...courses],
      targets: { ...(state.settings.targets || {}), [code]: findAvailableItem(code) }
    };
    await chrome.storage.local.set({ settings: state.settings });
    state.statuses[code] = { label: 'Chờ xử lý', kind: '', message: 'Đã thêm từ danh sách lớp của cổng.', at: Date.now() };
    await chrome.storage.local.set({ statuses: state.statuses });
    renderStatuses();
    flash(`Đã thêm ${code} vào hàng đợi.`);
  }
}

function findAvailableItem(code) {
  for (const items of Object.values(state.available)) {
    const found = items.find(item => (item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID) === code);
    if (found) return found;
  }
  return null;
}

async function processCourse(code) {
  const rawCode = cleanSubjectCode(code);
  const studyProgramId = state.settings.studyProgramId;
  const typeRegist = state.settings.action === 'NKH' ? 'NKH' : 'KH';

  if (!studyProgramId || !typeRegist || !rawCode) {
    return setFailure(code, `Thiếu tham số bắt buộc: ReqParam1 (${studyProgramId || 'thiếu'}), ReqParam2 (${typeRegist}), ReqParam3 (${rawCode || 'thiếu'}).`);
  }

  // 1. Tự động lấy danh sách lớp bằng cách thử biến thể mã (SYTH220491 / 261SYTH220491) & chế độ (KH / NKH)
  const { ok, search, classes: allClasses, matchedCode, matchedMode } = await fetchSubjectClasses(rawCode, studyProgramId, typeRegist);

  addLog(code, 'Kiểm tra sỉ số môn', search);
  if (!ok) return setFailure(code, responseMessage(search));

  if (!allClasses.length) return setFailure(code, `API không trả về lớp nào cho môn ${rawCode} (đã thử cả KH/NKH & định dạng mã).`);

  // 2. Lọc các lớp người dùng đã tick chọn (hoặc tất cả nếu chưa bỏ tick nào)
  const targetClassCodes = state.settings.targetClasses?.[rawCode] || state.settings.targetClasses?.[matchedCode] || [];
  let candidates = allClasses;

  if (code.includes('_')) {
    const norm = code.toUpperCase();
    candidates = allClasses.filter(item => {
      const fields = [item.CurriculumID, item.ScheduleStudyUnitAlias, item.StudyUnitID].filter(Boolean).map(x => String(x).toUpperCase());
      return fields.some(v => v === norm || v.endsWith(norm) || norm.endsWith(v));
    });
  } else if (targetClassCodes.length > 0) {
    candidates = allClasses.filter(item => {
      const classCode = item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID;
      return targetClassCodes.includes(classCode);
    });
  }

  if (!candidates.length) candidates = allClasses;

  // 3. Kiểm tra xem môn/lớp đã được đăng ký thành công chưa
  if (candidates.some(x => x.IsRegisted === true)) {
    return setSuccess(code, 'Môn học đã có lớp đăng ký thành công.');
  }

  // 4. Lọc ra danh sách các lớp CÒN CHỖ TRỐNG (NumberOfStudents < MaxStudentNumber)
  const availableClasses = candidates.filter(item => {
    const cur = item.NumberOfStudents != null ? Number(item.NumberOfStudents) : null;
    const mx = item.MaxStudentNumber != null ? Number(item.MaxStudentNumber) : null;
    return cur != null && mx != null && mx > 0 && cur < mx;
  });

  if (!availableClasses.length) {
    state.statuses[code] = {
      label: 'Đang theo dõi',
      kind: 'working',
      message: `Môn ${rawCode} (${candidates.length} lớp chọn) · Tất cả đều đã đầy. Đang chờ nhả chỗ…`,
      at: Date.now()
    };
    renderStatuses();
    return;
  }

  // 5. PHÁT HIỆN CÓ LỚP TRỐNG CHỖ! Lập tức chọn lớp trống đó và gửi API đăng ký ngay
  const targetClass = availableClasses[0];
  const targetCode = targetClass.ScheduleStudyUnitAlias || targetClass.CurriculumID || targetClass.StudyUnitID;
  const current = targetClass.NumberOfStudents;
  const max = targetClass.MaxStudentNumber;
  const seatMsg = `(${current}/${max} SV - Còn ${max - current} chỗ)`;

  state.statuses[code] = {
    label: 'Có chỗ trống!',
    kind: 'working',
    message: `Phát hiện lớp ${targetCode} ${seatMsg}! Đang gửi API đăng ký…`,
    at: Date.now()
  };
  renderStatuses();

  const payload = [targetClass];
  const turnId = state.settings.turnId;
  const rawAction = (state.settings.action || 'REGIST').toUpperCase();
  const registAction = rawAction === 'CHANGE' ? 'CHANGE' : 'REGIST';

  // 1. Kiểm tra điều kiện (CheckExitsRegist cho Đăng ký mới, CheckExitsRegistChange cho Đổi lớp)
  let checkPath = registAction === 'CHANGE'
    ? `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(studyProgramId)}`
    : `CheckExitsRegist?StudyProgramID=${encodeURIComponent(studyProgramId)}`;

  let check = await request(checkPath, payload);
  addLog(code, `Kiểm tra ${targetCode}`, check);

  // Fallback: nếu gọi CheckExitsRegist/CheckExitsRegistChange gặp lỗi, tự động thử đường dẫn còn lại
  if (!check.ok || isBusinessFailure(check.data)) {
    const altCheckPath = registAction === 'CHANGE'
      ? `CheckExitsRegist?StudyProgramID=${encodeURIComponent(studyProgramId)}`
      : `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(studyProgramId)}`;
    const retryCheck = await request(altCheckPath, payload);
    if (retryCheck.ok && !isBusinessFailure(retryCheck.data)) {
      check = retryCheck;
    }
  }

  // 2. Gửi API đăng ký chính thức RegistScheduleStudyUnit?TurnID=...&Action=REGIST/CHANGE&StudyProgramID=...
  const registerPath = `RegistScheduleStudyUnit?TurnID=${encodeURIComponent(turnId)}&Action=${encodeURIComponent(registAction)}&StudyProgramID=${encodeURIComponent(studyProgramId)}`;
  const registered = await request(registerPath, payload);
  addLog(code, `Đăng ký lớp ${targetCode}`, registered);
  if (registered.ok && !isBusinessFailure(registered.data)) {
    setSuccess(code, responseMessage(registered) || `API xác nhận đăng ký thành công lớp ${targetCode} ${seatMsg}.`);
  } else {
    setFailure(code, responseMessage(registered));
  }
}

async function request(path, body, method = 'POST') {
  return chrome.runtime.sendMessage({ type: 'API_REQUEST', path, body, method });
}

function isCourseItem(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Boolean(
    obj.CurriculumID || obj.StudyUnitID || obj.ScheduleStudyUnitAlias ||
    obj.CurriculumName || obj.StudyUnitName || obj.SubjectID || obj.SubjectName ||
    obj.ScheduleStudyUnitID || obj.CourseID
  );
}

function unwrapArray(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    const flattened = [];
    for (const item of data) {
      if (isCourseItem(item)) {
        flattened.push(item);
      } else if (item && typeof item === 'object') {
        const nested = unwrapArray(item);
        if (nested.length > 0) flattened.push(...nested);
      }
    }
    if (flattened.length > 0) return flattened;
    return data;
  }

  if (typeof data === 'object') {
    if (isCourseItem(data)) return [data];

    const arrayKeys = [
      'classStudyUnits', 'ClassStudyUnits', 'Selections', 'selections',
      'Rows', 'rows', 'Data', 'data', 'Result', 'result', 'Items', 'items',
      'Curriculums', 'curriculums', 'ScheduleStudyUnits', 'scheduleStudyUnits',
      'StudyUnits', 'studyUnits', 'Classes', 'classes', 'List', 'list',
      'Content', 'content', 'Value', 'value', 'DsMonHoc', 'dsMonHoc',
      'DsLopHocPhan', 'dsLopHocPhan'
    ];

    const results = [];
    for (const key of arrayKeys) {
      if (data[key] != null) {
        const unwrapped = unwrapArray(data[key]);
        if (unwrapped.length > 0) results.push(...unwrapped);
      }
    }
    if (results.length > 0) return results;

    for (const val of Object.values(data)) {
      if (val && typeof val === 'object') {
        const unwrapped = unwrapArray(val);
        if (unwrapped.length > 0) results.push(...unwrapped);
      }
    }
    if (results.length > 0) return results;
  }

  return [];
}

function classSummary(item) {
  const alias = item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID || extractSubjectCode(item) || 'Không rõ mã lớp';
  const name = item.CurriculumName || item.StudyUnitName || item.SubjectName || '';
  const credits = item.Credits != null ? `${item.Credits} STC` : '';
  const numClasses = item.NumberOfScheduleStudyUnit != null ? `${item.NumberOfScheduleStudyUnit} lớp HP` : '';
  const seats = item.NumberOfStudents != null && item.MaxStudentNumber != null
    ? `${item.NumberOfStudents}/${item.MaxStudentNumber} SV`
    : numClasses;
  const teacher = item.ProfessorName?.trim() || item.TeacherName?.trim() || '';
  return [alias, name, credits, teacher, seats].filter(Boolean).join(' · ');
}

function isBusinessFailure(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.Success === false || data.success === false || data.IsSuccess === false || data.isSuccess === false) return true;
  const text = responseMessage({ data }).toLowerCase();
  return /không thành công|that bai|thất bại|không thể|error|failed/.test(text);
}

function responseMessage(result) {
  if (result?.error) return result.error;
  const data = result?.data;
  if (typeof data === 'string') return data;
  for (const key of ['Message','message','Msg','msg','Error','error']) if (data?.[key]) return String(data[key]);
  if (data == null) return `HTTP ${result?.status || 0}`;
  try { return JSON.stringify(data); } catch { return String(data); }
}

function setSuccess(code, message) {
  state.statuses[code] = { label: 'Thành công', kind: 'success', message, at: Date.now() };
  if (!state.runner.successCodes.includes(code)) state.runner.successCodes.push(code);
}

function setFailure(code, message) {
  state.statuses[code] = { label: 'Chưa thành công', kind: 'error', message, at: Date.now() };
}

function addLog(code, step, result, opts = {}) {
  const rows = unwrapArray(result?.data);
  const openClasses = rows.filter(item => {
    const cur = item.NumberOfStudents != null ? Number(item.NumberOfStudents) : null;
    const mx = item.MaxStudentNumber != null ? Number(item.MaxStudentNumber) : null;
    return cur != null && mx != null && mx > 0 && cur < mx;
  });

  const hasSlot = opts.hasSlot ?? (openClasses.length > 0);

  let message = responseMessage(result);
  if (step === 'Kiểm tra sỉ số môn' || step === 'Tìm lớp') {
    if (hasSlot) {
      message = `🔥 CÓ ${openClasses.length} LỚP CÒN CHỖ: ${openClasses.map(classSummary).join(' | ')}`;
    } else if (rows.length) {
      message = `Tất cả ${rows.length} lớp đều đã đầy (${rows.slice(0, 3).map(classSummary).join(' | ')})`;
    }
  }

  state.logs.unshift({
    at: Date.now(),
    code,
    step,
    ok: Boolean(result?.ok) && !isBusinessFailure(result?.data),
    status: result?.status,
    message,
    hasSlot: Boolean(hasSlot)
  });
  state.logs = state.logs.slice(0, 300);
  chrome.storage.local.set({ logs: state.logs });
  renderLogs();
}

function render() { renderRunState(); renderStatuses(); renderLogs(); }

function renderRunState() {
  $('runBadge').className = `badge ${state.runner.running ? 'running' : 'idle'}`;
  $('runBadge').innerHTML = `<span></span>${state.runner.running ? `Đang chạy · ${state.settings.intervalSeconds}s` : 'Đang dừng'}`;
  $('start').disabled = state.runner.running;
  $('stop').disabled = !state.runner.running;
}

function renderStatuses() {
  const courses = state.settings.courses || [];
  $('courseStatuses').innerHTML = courses.length ? courses.map(code => {
    const s = state.statuses[code] || { label: 'Chờ chạy', kind: '' };
    return `<article class="course-item"><div><div class="course-code">${escapeHtml(code)}</div><div class="course-meta">${escapeHtml(s.message || 'Chưa gửi API')}</div></div><span class="pill ${s.kind}">${escapeHtml(s.label)}</span></article>`;
  }).join('') : '<div class="empty">Chưa có mã lớp nào.</div>';
}

function renderLogs() {
  $('logs').innerHTML = state.logs.length ? state.logs.map(log => {
    const isSlot = log.hasSlot;
    const badgeClass = isSlot ? 'ok slot-open' : (log.ok ? 'ok' : 'fail');
    const badgeText = isSlot ? '🔥 CÓ CHỖ TRỐNG' : (log.ok ? 'OK' : `Lỗi ${log.status || ''}`);
    const rowClass = isSlot ? 'log-row slot-highlight' : 'log-row';

    return `<div class="${rowClass}">
      <span>${new Date(log.at).toLocaleString('vi-VN')}</span>
      <strong>${escapeHtml(log.code)}</strong>
      <span>${escapeHtml(log.step)}</span>
      <span class="${badgeClass}">${badgeText}</span>
      <code>${escapeHtml(log.message).slice(0, 1500)}</code>
    </div>`;
  }).join('') : '<div class="empty">Chưa có yêu cầu nào được gửi.</div>';
}

function flash(message, error = false) { $('formMessage').textContent = message; $('formMessage').style.color = error ? 'var(--red)' : 'var(--green)'; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
