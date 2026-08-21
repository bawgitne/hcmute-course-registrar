import React, { useState } from 'react';
import { BookOpen, RefreshCw, AlertCircle, Plus, Check, ChevronDown, ChevronUp, UserCheck, Users } from 'lucide-react';
import { fetchSubjectClasses, extractSubjectCode, unwrapArray } from '../services/api';

export function CourseSelector({ settings, onAddCourse, onUpdateTargetClasses }) {
  const [activeTab, setActiveTab] = useState('registered');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [loadingClass, setLoadingClass] = useState({});
  const [addedItems, setAddedItems] = useState({});

  const loadCourses = async (mode = activeTab) => {
    setActiveTab(mode);
    if (!settings.token || !settings.studyProgramId || !settings.turnId) {
      setError('Chưa có đủ Session Token, StudyProgramID hoặc TurnID. Vui lòng dán cấu hình từ Console trước.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let result;
      if (mode === 'registered') {
        const body = {
          ReqParam1: String(settings.randId || 0),
          ReqParam2: String(settings.turnId)
        };
        const { apiRequest } = await import('../services/api');
        result = await apiRequest('GetAllClassRegisted', body, 'POST', settings);
      } else {
        const body = {
          ReqParam1: String(settings.studyProgramId),
          ReqParam2: mode,
          ReqParam3: settings.year || '2026-2027',
          ReqParam4: settings.semester || 'HK01',
          ReqParam5: ''
        };
        const { apiRequest } = await import('../services/api');
        result = await apiRequest('GetAllClassAllowRegist', body, 'POST', settings);
      }

      if (!result.ok) {
        setError(result.error || `HTTP ${result.status}`);
        setCourses([]);
      } else {
        const list = unwrapArray(result.data);
        setCourses(list);
        if (!list.length) {
          setError('API không trả về môn nào cho danh mục này.');
        }
      }
    } catch (e) {
      setError('Lỗi kết nối khi tải danh sách môn: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClasses = async (item, index) => {
    const key = `${extractSubjectCode(item)}:${index}`;
    if (expandedClasses[key]) {
      setExpandedClasses((prev) => ({ ...prev, [key]: null }));
      return;
    }

    setLoadingClass((prev) => ({ ...prev, [key]: true }));

    const subjectId = extractSubjectCode(item);
    const typeRegist = item.TypeRegist || (activeTab === 'NKH' ? 'NKH' : 'KH');

    const res = await fetchSubjectClasses(subjectId, settings, typeRegist);
    setLoadingClass((prev) => ({ ...prev, [key]: false }));

    if (res.ok && res.classes.length > 0) {
      setExpandedClasses((prev) => ({ ...prev, [key]: res.classes }));
    } else {
      setExpandedClasses((prev) => ({ ...prev, [key]: [] }));
    }
  };

  const handleAddClick = (code) => {
    if (!code) return;
    onAddCourse(code);
    setAddedItems((prev) => ({ ...prev, [code]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [code]: false }));
    }, 1800);
  };

  const handleClassCheckbox = (subjectCode, classCode, checked) => {
    const targetClasses = { ...(settings.targetClasses || {}) };
    let current = targetClasses[subjectCode] || [];

    if (checked) {
      if (!current.includes(classCode)) current.push(classCode);
    } else {
      current = current.filter((c) => c !== classCode);
    }

    targetClasses[subjectCode] = current;
    onAddCourse(subjectCode, targetClasses);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-slate-900">
      {/* Step Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            03
          </span>
          <h2 className="text-sm font-bold text-slate-900">Tra cứu Môn &amp; Lớp học phần từ Cổng</h2>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => loadCourses('registered')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'registered'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          <span>Môn đã đăng ký</span>
        </button>

        <button
          onClick={() => loadCourses('KH')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'KH'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Môn theo kế hoạch (KH)</span>
        </button>

        <button
          onClick={() => loadCourses('NKH')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'NKH'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Môn ngoài kế hoạch (NKH)</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-blue-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Đang tải danh sách môn từ cổng HCMUTE...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Course List */}
      {!loading && !error && courses.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 bg-slate-50/50">
          Bấm một trong các nút ở trên để tải danh sách môn từ cổng.
        </div>
      )}

      {!loading && courses.length > 0 && (
        <div className="max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {courses.map((item, index) => {
            const subjectCode = extractSubjectCode(item);
            const itemCode = item.ScheduleStudyUnitAlias || item.CurriculumID || item.StudyUnitID || subjectCode;
            const key = `${subjectCode}:${index}`;
            const classOptions = expandedClasses[key];
            const isRegisted = item.IsRegisted === true || activeTab === 'registered';
            const isAdded = addedItems[itemCode] || addedItems[subjectCode];

            return (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {itemCode}
                      </span>
                      {isRegisted ? (
                        <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Đã đăng ký
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Chưa đăng ký
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-900">
                      {item.CurriculumName || item.StudyUnitName || item.SubjectName || 'Môn học'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {[
                        item.Credits ? `${item.Credits} STC` : '',
                        item.ProfessorName?.trim() || item.TeacherName?.trim() || '',
                        item.NumberOfStudents != null && item.MaxStudentNumber != null ? `${item.NumberOfStudents}/${item.MaxStudentNumber} SV` : ''
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddClick(subjectCode || itemCode)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all shadow-xs ${
                        isAdded
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {isAdded ? <Check className="h-3 w-3 text-emerald-600" /> : <Plus className="h-3 w-3" />}
                      <span>{isAdded ? 'Đã thêm!' : 'Thêm môn'}</span>
                    </button>

                    <button
                      onClick={() => handleToggleClasses(item, index)}
                      disabled={loadingClass[key]}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                      {loadingClass[key] ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
                      ) : classOptions ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <span>{classOptions ? 'Ẩn lớp' : 'Hiện lớp'}</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Class Options */}
                {classOptions && (
                  <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Chọn lớp HP cần canh chỗ của môn <span className="text-blue-700 font-bold">{subjectCode}</span>:
                    </div>

                    {classOptions.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic">Không tìm thấy lớp học phần phù hợp.</div>
                    ) : (
                      classOptions.map((cls) => {
                        const classCode = cls.ScheduleStudyUnitAlias || cls.CurriculumID || cls.StudyUnitID;
                        const cur = cls.NumberOfStudents != null ? Number(cls.NumberOfStudents) : null;
                        const max = cls.MaxStudentNumber != null ? Number(cls.MaxStudentNumber) : null;
                        const isFull = cur != null && max != null && max > 0 && cur >= max;
                        const isChecked = (settings.targetClasses?.[subjectCode] || []).includes(classCode);
                        const isClassAdded = addedItems[classCode];

                        return (
                          <div key={classCode} className="flex items-center justify-between rounded-lg bg-white border border-slate-200 p-2 text-xs shadow-xs">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleClassCheckbox(subjectCode, classCode, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-mono font-bold text-slate-900">{classCode}</span>
                                {cur != null && max != null && (
                                  <span className={`ml-2 text-[10px] font-bold ${isFull ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {isFull ? `Đã đầy (${cur}/${max})` : `Còn ${max - cur} chỗ (${cur}/${max})`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleAddClick(classCode)}
                              className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                isClassAdded
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {isClassAdded ? '✓ Đã thêm' : 'Thêm riêng lớp này'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
