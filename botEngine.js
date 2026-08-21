/**
 * Backend Bot Engine for HCMUTE Course Registration
 * Runs continuously in Node.js background process on Railway/Server
 */

const jobs = new Map(); // Store running jobs by session key (userId or default)

function getSessionKey(settings) {
  return settings.userId || settings.token?.slice(-20) || 'default';
}

function cleanSubjectCode(val) {
  if (!val) return '';
  return String(val).trim().replace(/_.*$/, '');
}

function extractSubjectCode(item) {
  if (!item) return '';
  if (typeof item === 'string') return cleanSubjectCode(item);
  if (item.StudyUnitID) return cleanSubjectCode(item.StudyUnitID);
  if (item.CurriculumID) return cleanSubjectCode(item.CurriculumID);
  if (item.ScheduleStudyUnitAlias) return cleanSubjectCode(item.ScheduleStudyUnitAlias);
  const candidates = [item.ScheduleStudyUnitID, item.SubjectID, item.SubjectCode, item.CurriculumCode, item.StudyUnitCode, item.Code, item.code];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return cleanSubjectCode(c);
  }
  return '';
}

function unwrapArray(data) {
  if (!data) return [];
  const isCourseItem = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    return Boolean(
      obj.CurriculumID || obj.StudyUnitID || obj.ScheduleStudyUnitAlias ||
      obj.CurriculumName || obj.StudyUnitName || obj.SubjectID || obj.SubjectName ||
      obj.ScheduleStudyUnitID || obj.CourseID
    );
  };

  if (Array.isArray(data)) {
    const flattened = [];
    for (const item of data) {
      if (isCourseItem(item)) flattened.push(item);
      else if (item && typeof item === 'object') {
        const nested = unwrapArray(item);
        if (nested.length) flattened.push(...nested);
      }
    }
    if (flattened.length) return flattened;
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
        if (unwrapped.length) results.push(...unwrapped);
      }
    }
    if (results.length) return results;

    for (const val of Object.values(data)) {
      if (val && typeof val === 'object') {
        const unwrapped = unwrapArray(val);
        if (unwrapped.length) results.push(...unwrapped);
      }
    }
    if (results.length) return results;
  }
  return [];
}

function getResponseMessage(data) {
  if (!data) return 'Không có phản hồi.';
  if (typeof data === 'string') return data;
  for (const key of ['Message', 'message', 'Msg', 'msg', 'Error', 'error']) {
    if (data[key]) return String(data[key]);
  }
  try { return JSON.stringify(data); } catch { return String(data); }
}

function isBusinessFailure(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.Success === false || data.success === false || data.IsSuccess === false || data.isSuccess === false) return true;
  const text = getResponseMessage(data).toLowerCase();
  return /không thành công|that bai|thất bại|không thể|error|failed/.test(text);
}

function isSessionExpiredError(status, data) {
  if (status === 401 || status === 403) return true;
  const text = (getResponseMessage(data) || '').toLowerCase();
  return /token|session|hết hạn|unauthorized|unauthenticated|đăng nhập lại|chưa có session/i.test(text);
}

async function apiRequest(path, body = null, method = 'POST', settings = {}) {
  const token = settings.token ? settings.token.replace(/^Bearer\s+/i, '').trim() : '';
  const apiKey = settings.apiKey || 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv';
  const clientId = settings.clientId || 'dtl';

  if (!token) {
    return { ok: false, status: 401, error: 'Chưa có Session Token.' };
  }

  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'apikey': apiKey,
      'clientid': clientId,
      'authorization': `Bearer ${token}`,
      'origin': 'https://dkmh.hcmute.edu.vn',
      'referer': 'https://dkmh.hcmute.edu.vn/'
    };

    const options = { method, headers };
    if (method !== 'GET' && body != null) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(`https://dangkyapi.hcmute.edu.vn/api/Regist/${path}`, options);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message || 'Lỗi kết nối mạng.' };
  }
}

async function fetchSubjectClasses(rawCode, settings, typeRegist = 'KH') {
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
      const search = await apiRequest('GetAllScheduleUnitAllowRegist', {
        ReqParam1: settings.studyProgramId,
        ReqParam2: mode,
        ReqParam3: reqCode
      }, 'POST', settings);
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

class JobRunner {
  constructor(key, settings) {
    this.key = key;
    this.settings = settings;
    this.isRunning = false;
    this.statusState = 'idle'; // 'running', 'stopped', 'expired', 'completed'
    this.statuses = {};
    this.logs = [];
    this.successCodes = new Set();
    this.timer = null;
    this.nextIndex = 0;
    this.lastTick = Date.now();
  }

  addLog(code, step, result) {
    const newLog = {
      time: new Date().toLocaleTimeString('vi-VN'),
      code,
      step,
      ok: result?.ok ?? false,
      status: result?.status ?? 0,
      response: getResponseMessage(result?.data || result?.error),
      data: result?.data || result
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 200) this.logs.pop();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusState = 'running';
    this.scheduleNext(100);
  }

  stop(reason = 'stopped') {
    this.isRunning = false;
    this.statusState = reason;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNext(ms) {
    if (!this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.runCycle(), ms);
  }

  async runCycle() {
    if (!this.isRunning) return;
    this.lastTick = Date.now();

    const pending = (this.settings.courses || []).filter(c => !this.successCodes.has(c));

    if (!pending.length) {
      this.addLog('SYSTEM', 'Hoàn tất', { ok: true, status: 200, data: 'Tất cả các môn trong hàng đợi đã được đăng ký thành công.' });
      this.stop('completed');
      return;
    }

    const idx = this.nextIndex % pending.length;
    const code = pending[idx];
    this.nextIndex = (idx + 1) % pending.length;

    this.statuses[code] = {
      label: 'Đang xử lý',
      kind: 'working',
      message: 'Đang kiểm tra sỉ số...',
      at: Date.now()
    };

    try {
      await this.processCourse(code);
    } catch (err) {
      this.addLog(code, 'Lỗi ngoại lệ', { ok: false, status: 500, error: err.message });
    }

    if (this.isRunning) {
      const intervalSec = Math.max(3, Number(this.settings.intervalSeconds) || 5);
      this.scheduleNext(intervalSec * 1000);
    }
  }

  async processCourse(code) {
    const rawCode = cleanSubjectCode(code);
    const studyProgramId = this.settings.studyProgramId;
    const typeRegist = this.settings.action === 'NKH' ? 'NKH' : 'KH';

    if (!studyProgramId || !rawCode || !this.settings.token) {
      this.statuses[code] = {
        label: 'Thiếu cấu hình',
        kind: 'error',
        message: 'Thiếu Session Token hoặc StudyProgramID.',
        at: Date.now()
      };
      return;
    }

    // 1. Scan subject classes
    const res = await fetchSubjectClasses(rawCode, this.settings, typeRegist);
    this.addLog(code, 'Kiểm tra sỉ số môn', res.search);

    // Check for Session Expired
    if (res.search && isSessionExpiredError(res.search.status, res.search.data)) {
      this.statuses[code] = {
        label: 'Session hết hạn',
        kind: 'error',
        message: 'Token đã hết hạn hoặc không hợp lệ. Đã dừng ngầm tự động.',
        at: Date.now()
      };
      this.addLog(code, 'Hết hạn Token', { ok: false, status: 401, error: 'Session Token đã hết hạn! Vui lòng dán Token mới.' });
      this.stop('expired');
      return;
    }

    if (!res.ok) {
      this.statuses[code] = {
        label: 'Lỗi API',
        kind: 'error',
        message: getResponseMessage(res.search?.data || res.search?.error),
        at: Date.now()
      };
      return;
    }

    const allClasses = res.classes;
    if (!allClasses.length) {
      this.statuses[code] = {
        label: 'Không có lớp',
        kind: 'error',
        message: `API không trả về lớp nào cho môn ${rawCode}.`,
        at: Date.now()
      };
      return;
    }

    // 2. Filter target classes
    const targetClassCodes = this.settings.targetClasses?.[rawCode] || this.settings.targetClasses?.[res.matchedCode] || [];
    let candidates = allClasses;

    if (code.includes('_')) {
      const norm = code.toUpperCase();
      candidates = allClasses.filter((item) => {
        const fields = [item.CurriculumID, item.ScheduleStudyUnitAlias, item.StudyUnitID].filter(Boolean).map((x) => String(x).toUpperCase());
        return fields.some((v) => v === norm || v.endsWith(norm) || norm.endsWith(v));
      });
    } else if (targetClassCodes.length > 0) {
      candidates = allClasses.filter((item) => {
        const classCode = item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID;
        return targetClassCodes.includes(classCode);
      });
    }

    if (!candidates.length) candidates = allClasses;

    // 3. Check if already registered
    const targetIsAlreadyRegistered = candidates.length > 0 && candidates.every((x) => x.IsRegisted === true);
    if (targetIsAlreadyRegistered) {
      this.statuses[code] = {
        label: 'Đã đăng ký',
        kind: 'success',
        message: 'Lớp học phần đã chọn đã được đăng ký thành công.',
        at: Date.now()
      };
      this.successCodes.add(code);
      return;
    }

    // 4. Find open seats
    const availableClasses = candidates.filter((item) => {
      const cur = item.NumberOfStudents != null ? Number(item.NumberOfStudents) : null;
      const mx = item.MaxStudentNumber != null ? Number(item.MaxStudentNumber) : null;
      return cur != null && mx != null && mx > 0 && cur < mx;
    });

    if (!availableClasses.length) {
      this.statuses[code] = {
        label: 'Đang theo dõi (Server)',
        kind: 'working',
        message: `Môn ${rawCode} (${candidates.length} lớp chọn) · Tất cả đều đã đầy. Đang chờ nhả chỗ…`,
        at: Date.now()
      };
      return;
    }

    // 5. Open seat detected! Register!
    const targetClass = availableClasses[0];
    const targetCode = targetClass.ScheduleStudyUnitAlias || targetClass.CurriculumID || targetClass.StudyUnitID;
    const current = targetClass.NumberOfStudents;
    const max = targetClass.MaxStudentNumber;
    const seatMsg = `(${current}/${max} SV - Còn ${max - current} chỗ)`;

    this.statuses[code] = {
      label: 'Phát hiện chỗ trống!',
      kind: 'working',
      message: `Phát hiện lớp ${targetCode} ${seatMsg}! Đang gửi API đăng ký từ Server…`,
      at: Date.now()
    };

    const payload = [targetClass];
    const turnId = this.settings.turnId;
    const rawAction = (this.settings.action || 'REGIST').toUpperCase();
    const registAction = rawAction === 'CHANGE' ? 'CHANGE' : 'REGIST';

    // 5.1 CheckExitsRegist / CheckExitsRegistChange
    const checkPath = registAction === 'CHANGE'
      ? `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(this.settings.studyProgramId)}`
      : `CheckExitsRegist?StudyProgramID=${encodeURIComponent(this.settings.studyProgramId)}`;

    let check = await apiRequest(checkPath, payload, 'POST', this.settings);
    this.addLog(code, `Kiểm tra ${targetCode}`, check);

    if (isSessionExpiredError(check.status, check.data)) {
      this.stop('expired');
      return;
    }

    if (!check.ok || isBusinessFailure(check.data)) {
      const altCheckPath = registAction === 'CHANGE'
        ? `CheckExitsRegist?StudyProgramID=${encodeURIComponent(this.settings.studyProgramId)}`
        : `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(this.settings.studyProgramId)}`;
      const retryCheck = await apiRequest(altCheckPath, payload, 'POST', this.settings);
      if (retryCheck.ok && !isBusinessFailure(retryCheck.data)) check = retryCheck;
    }

    // 5.2 RegistScheduleStudyUnit
    const registerPath = `RegistScheduleStudyUnit?TurnID=${encodeURIComponent(turnId)}&Action=${encodeURIComponent(registAction)}&StudyProgramID=${encodeURIComponent(this.settings.studyProgramId)}`;
    const registered = await apiRequest(registerPath, payload, 'POST', this.settings);
    this.addLog(code, `Đăng ký lớp ${targetCode}`, registered);

    if (isSessionExpiredError(registered.status, registered.data)) {
      this.stop('expired');
      return;
    }

    if (registered.ok && !isBusinessFailure(registered.data)) {
      this.statuses[code] = {
        label: 'Thành công',
        kind: 'success',
        message: getResponseMessage(registered.data) || `API xác nhận đăng ký thành công lớp ${targetCode} ${seatMsg}.`,
        at: Date.now()
      };
      this.successCodes.add(code);
    } else {
      this.statuses[code] = {
        label: 'Chưa thành công',
        kind: 'error',
        message: getResponseMessage(registered.data || registered.error),
        at: Date.now()
      };
    }
  }

  getSnapshot() {
    return {
      key: this.key,
      isRunning: this.isRunning,
      statusState: this.statusState, // 'running' | 'stopped' | 'expired' | 'completed'
      statuses: this.statuses,
      logs: this.logs.slice(0, 100),
      successCodes: Array.from(this.successCodes),
      lastTick: this.lastTick
    };
  }
}

export function startJob(settings) {
  const key = getSessionKey(settings);
  let job = jobs.get(key);
  if (job) {
    job.stop('stopped');
  }
  job = new JobRunner(key, settings);
  jobs.set(key, job);
  job.start();
  return job.getSnapshot();
}

export function stopJob(settings) {
  const key = getSessionKey(settings);
  const job = jobs.get(key);
  if (job) {
    job.stop('stopped');
    return job.getSnapshot();
  }
  return { isRunning: false, statusState: 'stopped', statuses: {}, logs: [] };
}

export function getJobStatus(settings) {
  const key = getSessionKey(settings);
  const job = jobs.get(key);
  if (job) {
    return job.getSnapshot();
  }
  return { isRunning: false, statusState: 'stopped', statuses: {}, logs: [] };
}
