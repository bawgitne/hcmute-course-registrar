import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImportModal } from './components/ImportModal';
import { ConfigPanel } from './components/ConfigPanel';
import { CourseSelector } from './components/CourseSelector';
import { QueuePanel } from './components/QueuePanel';
import { LogTable } from './components/LogTable';
import { apiRequest, fetchSubjectClasses, isBusinessFailure, getResponseMessage, cleanSubjectCode, unwrapArray } from './services/api';

const DEFAULT_SETTINGS = {
  token: '',
  studyProgramId: '24110',
  turnId: '81',
  randId: '0',
  apiKey: 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv',
  clientId: 'dtl',
  year: '2026-2027',
  semester: 'HK01',
  action: 'CHANGE',
  intervalSeconds: 5,
  courses: [],
  coursesText: '',
  targetClasses: {},
  userId: '',
  userName: ''
};

export default function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('hcmute_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [statuses, setStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem('hcmute_statuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('hcmute_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [successCodes, setSuccessCodes] = useState([]);

  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const nextIndexRef = useRef(0);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('hcmute_settings', JSON.stringify(settings));
  }, [settings]);

  // Save statuses to localStorage
  useEffect(() => {
    localStorage.setItem('hcmute_statuses', JSON.stringify(statuses));
  }, [statuses]);

  // Save logs to localStorage
  useEffect(() => {
    localStorage.setItem('hcmute_logs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (code, step, result) => {
    const newLog = {
      time: new Date().toLocaleTimeString('vi-VN'),
      code,
      step,
      ok: result?.ok ?? false,
      status: result?.status ?? 0,
      response: getResponseMessage(result?.data || result?.error),
      data: result?.data || result
    };

    setLogs((prev) => [newLog, ...prev.slice(0, 199)]);
  };

  const handleSaveSettings = (newForm) => {
    const courseList = [...new Set((newForm.coursesText || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];
    const updated = {
      ...settings,
      ...newForm,
      courses: courseList
    };
    setSettings(updated);
  };

  const handleImportJSON = (jsonConfig) => {
    const updated = {
      ...settings,
      token: jsonConfig.token || settings.token,
      studyProgramId: jsonConfig.studyProgramId || settings.studyProgramId,
      turnId: jsonConfig.turnId || settings.turnId,
      randId: jsonConfig.randId || settings.randId || '0',
      apiKey: jsonConfig.apiKey || settings.apiKey,
      clientId: jsonConfig.clientId || settings.clientId,
      year: jsonConfig.year || settings.year,
      semester: jsonConfig.semester || settings.semester,
      action: jsonConfig.action || settings.action,
      userId: jsonConfig.userId || settings.userId,
      userName: jsonConfig.userName || settings.userName
    };

    setSettings(updated);
  };

  const handleAddCourse = (courseCode, newTargetClasses = null) => {
    if (!courseCode) return;
    setSettings((prev) => {
      const currentList = new Set(prev.courses || []);
      currentList.add(courseCode);
      const newCourses = [...currentList];
      return {
        ...prev,
        courses: newCourses,
        coursesText: newCourses.join('\n'),
        targetClasses: newTargetClasses ? newTargetClasses : (prev.targetClasses || {})
      };
    });

    setStatuses((prev) => ({
      ...prev,
      [courseCode]: { label: 'Chờ theo dõi', kind: 'idle', message: `Đã thêm ${courseCode} vào hàng đợi.`, at: Date.now() }
    }));
  };

  const handleRemoveCourse = (codeToRemove) => {
    const newCourses = settings.courses.filter((c) => c !== codeToRemove);
    const updated = {
      ...settings,
      courses: newCourses,
      coursesText: newCourses.join('\n')
    };
    setSettings(updated);
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[codeToRemove];
      return next;
    });
  };

  const handleClearQueue = () => {
    const updated = {
      ...settings,
      courses: [],
      coursesText: ''
    };
    setSettings(updated);
    setStatuses({});
  };

  const handleUpdateTargetClasses = (targetClasses) => {
    setSettings((prev) => ({ ...prev, targetClasses }));
  };

  const processCourse = async (code) => {
    const rawCode = cleanSubjectCode(code);
    const studyProgramId = settings.studyProgramId;
    const typeRegist = settings.action === 'NKH' ? 'NKH' : 'KH';

    if (!studyProgramId || !rawCode || !settings.token) {
      setStatuses((prev) => ({
        ...prev,
        [code]: { label: 'Thiếu cấu hình', kind: 'error', message: 'Thiếu Session Token hoặc StudyProgramID.', at: Date.now() }
      }));
      return;
    }

    // 1. Quét thông tin sỉ số các lớp học phần
    const res = await fetchSubjectClasses(rawCode, settings, typeRegist);
    addLog(code, 'Kiểm tra sỉ số môn', res.search);

    if (!res.ok) {
      setStatuses((prev) => ({
        ...prev,
        [code]: { label: 'Lỗi API', kind: 'error', message: getResponseMessage(res.search?.data || res.search?.error), at: Date.now() }
      }));
      return;
    }

    const allClasses = res.classes;
    if (!allClasses.length) {
      setStatuses((prev) => ({
        ...prev,
        [code]: { label: 'Không có lớp', kind: 'error', message: `API không trả về lớp nào cho môn ${rawCode}.`, at: Date.now() }
      }));
      return;
    }

    // 2. Lọc các lớp người dùng đã tick chọn
    const targetClassCodes = settings.targetClasses?.[rawCode] || settings.targetClasses?.[res.matchedCode] || [];
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

    // 3. Kiểm tra xem LỚP CẦN THEO DÕI đã được đăng ký thành công hay chưa
    const targetIsAlreadyRegistered = candidates.length > 0 && candidates.every((x) => x.IsRegisted === true);
    if (targetIsAlreadyRegistered) {
      setStatuses((prev) => ({
        ...prev,
        [code]: { label: 'Đã đăng ký', kind: 'success', message: 'Lớp học phần đã chọn đã được đăng ký thành công.', at: Date.now() }
      }));
      if (!successCodes.includes(code)) setSuccessCodes((prev) => [...prev, code]);
      return;
    }

    // 4. Lọc danh sách lớp còn chỗ trống (NumberOfStudents < MaxStudentNumber)
    const availableClasses = candidates.filter((item) => {
      const cur = item.NumberOfStudents != null ? Number(item.NumberOfStudents) : null;
      const mx = item.MaxStudentNumber != null ? Number(item.MaxStudentNumber) : null;
      return cur != null && mx != null && mx > 0 && cur < mx;
    });

    if (!availableClasses.length) {
      setStatuses((prev) => ({
        ...prev,
        [code]: {
          label: 'Đang theo dõi',
          kind: 'working',
          message: `Môn ${rawCode} (${candidates.length} lớp chọn) · Tất cả đều đã đầy. Đang chờ nhả chỗ…`,
          at: Date.now()
        }
      }));
      return;
    }

    // 5. PHÁT HIỆN CÓ LỚP TRỐNG CHỖ -> GỬI API ĐĂNG KÝ NGAY!
    const targetClass = availableClasses[0];
    const targetCode = targetClass.ScheduleStudyUnitAlias || targetClass.CurriculumID || targetClass.StudyUnitID;
    const current = targetClass.NumberOfStudents;
    const max = targetClass.MaxStudentNumber;
    const seatMsg = `(${current}/${max} SV - Còn ${max - current} chỗ)`;

    setStatuses((prev) => ({
      ...prev,
      [code]: {
        label: 'Có chỗ trống!',
        kind: 'working',
        message: `Phát hiện lớp ${targetCode} ${seatMsg}! Đang gửi API đăng ký…`,
        at: Date.now()
      }
    }));

    const payload = [targetClass];
    const turnId = settings.turnId;
    const rawAction = (settings.action || 'REGIST').toUpperCase();
    const registAction = rawAction === 'CHANGE' ? 'CHANGE' : 'REGIST';

    // 5.1 CheckExitsRegist / CheckExitsRegistChange
    const checkPath = registAction === 'CHANGE'
      ? `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(settings.studyProgramId)}`
      : `CheckExitsRegist?StudyProgramID=${encodeURIComponent(settings.studyProgramId)}`;

    let check = await apiRequest(checkPath, payload, 'POST', settings);
    addLog(code, `Kiểm tra ${targetCode}`, check);

    // Fallback path
    if (!check.ok || isBusinessFailure(check.data)) {
      const altCheckPath = registAction === 'CHANGE'
        ? `CheckExitsRegist?StudyProgramID=${encodeURIComponent(settings.studyProgramId)}`
        : `CheckExitsRegistChange?TurnID=${encodeURIComponent(turnId)}&StudyProgramID=${encodeURIComponent(settings.studyProgramId)}`;
      const retryCheck = await apiRequest(altCheckPath, payload, 'POST', settings);
      if (retryCheck.ok && !isBusinessFailure(retryCheck.data)) check = retryCheck;
    }

    // 5.2 RegistScheduleStudyUnit
    const registerPath = `RegistScheduleStudyUnit?TurnID=${encodeURIComponent(turnId)}&Action=${encodeURIComponent(registAction)}&StudyProgramID=${encodeURIComponent(settings.studyProgramId)}`;
    const registered = await apiRequest(registerPath, payload, 'POST', settings);
    addLog(code, `Đăng ký lớp ${targetCode}`, registered);

    if (registered.ok && !isBusinessFailure(registered.data)) {
      setStatuses((prev) => ({
        ...prev,
        [code]: {
          label: 'Thành công',
          kind: 'success',
          message: getResponseMessage(registered.data) || `API xác nhận đăng ký thành công lớp ${targetCode} ${seatMsg}.`,
          at: Date.now()
        }
      }));
      if (!successCodes.includes(code)) setSuccessCodes((prev) => [...prev, code]);
    } else {
      setStatuses((prev) => ({
        ...prev,
        [code]: {
          label: 'Chưa thành công',
          kind: 'error',
          message: getResponseMessage(registered.data || registered.error),
          at: Date.now()
        }
      }));
    }
  };

  const runCycle = async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      const pending = settings.courses.filter((c) => !successCodes.includes(c));
      if (!pending.length) return;

      const idx = nextIndexRef.current % pending.length;
      const code = pending[idx];
      nextIndexRef.current = (idx + 1) % pending.length;

      setStatuses((prev) => ({
        ...prev,
        [code]: { label: 'Đang xử lý', kind: 'working', message: 'Đang kiểm tra sỉ số sỉ...', at: Date.now() }
      }));

      await processCourse(code);
    } finally {
      busyRef.current = false;
    }
  };

  const handleStartBot = async () => {
    if (!settings.token || !settings.courses.length) {
      alert('Vui lòng dán Session Token và nhập ít nhất 1 mã môn/lớp trước khi chạy!');
      return;
    }
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.ok) {
        setIsRunning(true);
      }
    } catch (e) {
      alert('Không thể khởi chạy Bot ngầm trên Server: ' + e.message);
    }
  };

  const handleStopBot = async () => {
    try {
      const res = await fetch('/api/bot/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.ok) {
        setIsRunning(false);
      }
    } catch (e) {
      setIsRunning(false);
    }
  };

  // Sync background bot status with server
  useEffect(() => {
    let timer = null;

    const pollStatus = async () => {
      if (!settings.token) return;
      try {
        const res = await fetch('/api/bot/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const json = await res.json();
        if (json.ok && json.data) {
          const snapshot = json.data;
          setIsRunning(snapshot.isRunning);

          if (snapshot.statuses && Object.keys(snapshot.statuses).length > 0) {
            setStatuses((prev) => ({ ...prev, ...snapshot.statuses }));
          }

          if (snapshot.logs && snapshot.logs.length > 0) {
            setLogs((prev) => {
              const combined = [...snapshot.logs, ...prev];
              const unique = [];
              const seen = new Set();
              for (const item of combined) {
                const id = `${item.time}:${item.code}:${item.step}`;
                if (!seen.has(id)) {
                  seen.add(id);
                  unique.push(item);
                }
              }
              return unique.slice(0, 200);
            });
          }

          if (snapshot.successCodes && snapshot.successCodes.length > 0) {
            setSuccessCodes(snapshot.successCodes);
          }

          if (snapshot.statusState === 'expired') {
            setIsRunning(false);
          }
        }
      } catch (e) {
        // Silent fallback
      }
    };

    pollStatus();
    timer = setInterval(pollStatus, 2500);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [settings]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Header Bar */}
      <Header
        isRunning={isRunning}
        onStart={handleStartBot}
        onStop={handleStopBot}
        onOpenImport={() => setIsImportOpen(true)}
        hasToken={Boolean(settings.token)}
        userId={settings.userId}
        userName={settings.userName}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Config Panel */}
          <ConfigPanel
            settings={settings}
            onSaveSettings={handleSaveSettings}
            courseCount={settings.courses.length}
          />

          {/* Right Column: Course Selector Tabs */}
          <CourseSelector
            settings={settings}
            onAddCourse={handleAddCourse}
            onUpdateTargetClasses={handleUpdateTargetClasses}
          />
        </div>

        {/* Bottom Row: Queue Panel & API Log Table */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <QueuePanel
            courses={settings.courses}
            statuses={statuses}
            onRunOnce={() => runCycle()}
            onRemoveCourse={handleRemoveCourse}
            onClearQueue={handleClearQueue}
          />

          <LogTable
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        </div>
      </main>

      {/* Quick Config Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportJSON}
      />
    </div>
  );
}
