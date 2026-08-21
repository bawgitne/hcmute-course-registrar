import React, { useState } from 'react';
import { Settings2, ChevronDown, ChevronUp, Save } from 'lucide-react';

export function ConfigPanel({ settings, onSaveSettings, courseCount }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState(settings);

  React.useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(form);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5 text-slate-900">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header Step 01 */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              01
            </span>
            <h2 className="text-sm font-bold text-slate-900">Phiên &amp; Quy Tắc Đăng Ký</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono font-medium">HCMUTE API</span>
        </div>

        {/* Basic Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">StudyProgramID (Mã ngành)</label>
            <input
              type="text"
              name="studyProgramId"
              value={form.studyProgramId || ''}
              onChange={handleChange}
              placeholder="24110"
              required
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Đợt Đăng Ký (TurnID)</label>
            <input
              type="text"
              name="turnId"
              value={form.turnId || ''}
              onChange={handleChange}
              placeholder="81"
              required
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chu kỳ kiểm tra (giây)</label>
            <input
              type="number"
              name="intervalSeconds"
              min="3"
              max="60"
              value={form.intervalSeconds || 5}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Advanced API Config Accordion */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Cấu hình API nâng cao (API Key, Action, Year, Semester...)</span>
            </div>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Hành động (Action)</label>
                <select
                  name="action"
                  value={form.action || 'CHANGE'}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="CHANGE">CHANGE (Đổi / Đăng ký lớp)</option>
                  <option value="REGIST">REGIST (Đăng ký mới)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Năm học</label>
                <input
                  type="text"
                  name="year"
                  value={form.year || '2026-2027'}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Học kỳ</label>
                <input
                  type="text"
                  name="semester"
                  value={form.semester || 'HK01'}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">API Key</label>
                <input
                  type="text"
                  name="apiKey"
                  value={form.apiKey || ''}
                  onChange={handleChange}
                  placeholder="pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Client ID</label>
                <input
                  type="text"
                  name="clientId"
                  value={form.clientId || ''}
                  onChange={handleChange}
                  placeholder="dtl"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 02: Courses Textarea */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                02
              </span>
              <h2 className="text-sm font-bold text-slate-900">Danh sách Mã môn / Mã lớp HP</h2>
            </div>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {courseCount} môn / lớp
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Nhập mã môn học (ví dụ: <code className="text-blue-700 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono">DBMS330284</code>, <code className="text-blue-700 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono">SYTH220491</code>) hoặc mã lớp HP (ví dụ: <code className="text-blue-700 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono">261WEPR330479_01</code>). Mỗi mã một dòng hoặc cách nhau bởi dấu phẩy.
          </p>

          <textarea
            name="coursesText"
            value={form.coursesText || ''}
            onChange={handleChange}
            rows={5}
            placeholder="DBMS330284&#10;SOEN330679&#10;261WEPR330479_01"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Lưu Cấu Hình</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
