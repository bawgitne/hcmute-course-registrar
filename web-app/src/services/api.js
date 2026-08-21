const API_BASE = '/api/Regist';

/**
 * Gửi HTTP Request trực tiếp tới API HCMUTE
 */
export async function apiRequest(path, body = null, method = 'POST', settings = {}) {
  const token = settings.token ? settings.token.replace(/^Bearer\s+/i, '').trim() : '';
  const apiKey = settings.apiKey || 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv';
  const clientId = settings.clientId || 'dtl';

  if (!token) {
    return { ok: false, status: 0, error: 'Chưa có Session Token.' };
  }

  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'apikey': apiKey,
      'clientid': clientId,
      'authorization': `Bearer ${token}`
    };

    const options = { method, headers };
    if (method !== 'GET' && body != null) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}/${path}`, options);
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

/**
 * Bóc tách mảng môn học từ cấu trúc JSON lồng nhau của API HCMUTE
 */
export function unwrapArray(data) {
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

/**
 * Làm sạch mã môn học (bỏ hậu tố _01, _02,...)
 */
export function cleanSubjectCode(val) {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/_.*$/, '');
  return str;
}

/**
 * Trích xuất mã môn học chính xác nhất từ object lớp học phần
 */
export function extractSubjectCode(item) {
  if (!item) return '';
  if (typeof item === 'string') return cleanSubjectCode(item);

  if (item.StudyUnitID != null && String(item.StudyUnitID).trim() !== '') return cleanSubjectCode(item.StudyUnitID);
  if (item.CurriculumID != null && String(item.CurriculumID).trim() !== '') return cleanSubjectCode(item.CurriculumID);
  if (item.ScheduleStudyUnitAlias != null && String(item.ScheduleStudyUnitAlias).trim() !== '') return cleanSubjectCode(item.ScheduleStudyUnitAlias);

  const candidates = [item.ScheduleStudyUnitID, item.SubjectID, item.SubjectCode, item.CurriculumCode, item.StudyUnitCode, item.Code, item.code];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return cleanSubjectCode(c);
  }
  return '';
}

/**
 * Truy vấn danh sách lớp HP của một môn học (thử biến thể mã và chế độ KH/NKH)
 */
export async function fetchSubjectClasses(rawCode, settings, typeRegist = 'KH') {
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

/**
 * Kiểm tra response có chứa thông điệp thất bại nghiệp vụ hay không
 */
export function isBusinessFailure(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.Success === false || data.success === false || data.IsSuccess === false || data.isSuccess === false) return true;
  const text = getResponseMessage(data).toLowerCase();
  return /không thành công|that bai|thất bại|không thể|error|failed/.test(text);
}

/**
 * Lấy câu thông báo lỗi/thành công từ response
 */
export function getResponseMessage(data) {
  if (!data) return 'Không có phản hồi.';
  if (typeof data === 'string') return data;
  for (const key of ['Message', 'message', 'Msg', 'msg', 'Error', 'error']) {
    if (data[key]) return String(data[key]);
  }
  try { return JSON.stringify(data); } catch { return String(data); }
}
