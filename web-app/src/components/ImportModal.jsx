import React, { useState } from 'react';
import { X, Clipboard, Check, Terminal, FileCode2, AlertCircle } from 'lucide-react';

export function ImportModal({ isOpen, onClose, onImport }) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        setError('');
      }
    } catch (e) {
      setError('Trình duyệt không cho phép tự động đọc clipboard. Vui lòng bấm Ctrl+V để dán.');
    }
  };

  const handleApply = () => {
    if (!jsonText.trim()) {
      setError('Vui lòng dán chuỗi JSON cấu hình vào ô dưới.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonText.trim());
      if (!parsed.token && !parsed.Token) {
        setError('JSON không chứa trường token/Token. Vui lòng chạy lại script Console trên dkmh.hcmute.edu.vn');
        return;
      }
      onImport(parsed);
      setJsonText('');
      setError('');
      onClose();
    } catch (e) {
      setError('JSON không đúng định dạng. Vui lòng kiểm tra lại đoạn code dán vào.');
    }
  };

  const copyConsoleSnippet = async () => {
    const code = `(async function () {
  let token = ''; let authData = null;
  try { const r = localStorage.getItem('authorizationData'); if (r) { authData = JSON.parse(r); token = authData.Token || authData.token; } } catch(e){}
  if (!token) {
    const p = /eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/;
    for (let i=0; i<localStorage.length; i++) { const m = (localStorage.getItem(localStorage.key(i))||'').match(p); if (m) { token = m[0]; break; } }
  }
  let userId = authData?.Id || ''; let studyProgramId = '';
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(decodeURIComponent(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      if (payload.StudyProgramIds) studyProgramId = String(payload.StudyProgramIds).split(',')[0].trim();
      if (!userId && payload.Id) userId = String(payload.Id);
    }
  } catch(e){}
  if (!studyProgramId || studyProgramId.length > 6) studyProgramId = (userId && userId.length >= 5) ? userId.substring(0, 5) : '24110';
  let turnId = '81', randId = '0', year = '2026-2027', semester = 'HK01';
  try {
    const res = await fetch(\`https://dangkyapi.hcmute.edu.vn/api/Regist/GetRegistSemesterCreditQuota?StudyProgramID=\${studyProgramId}\`, {
      headers: { authorization: 'Bearer ' + token, apikey: 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv', clientid: 'dtl' }
    });
    const data = (await res.json())?.Data;
    if (data) { turnId = String(data.IdDot||81); randId = String(data.RandID||0); year = data.YearStudy||year; semester = data.SemesterID||semester; }
  } catch(e){}
  const cfg = { token, studyProgramId, turnId, randId, apiKey: 'pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv', clientId: 'dtl', year, semester, action: 'CHANGE', userId };
  const json = JSON.stringify(cfg, null, 2);
  try { if (typeof copy === 'function') copy(json); } catch(e){}
  console.log(json);
  return json;
})();`;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch (e) {
      alert('Không thể copy tự động');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Dán JSON Cấu Hình từ Console</h2>
              <p className="text-xs text-slate-500">Nhập chuỗi cấu hình được trích xuất từ trang dkmh.hcmute.edu.vn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Console Script Quick Hint */}
        <div className="my-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Terminal className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-blue-900">Chưa có JSON Cấu Hình?</h4>
                <p className="text-xs text-slate-700 mt-0.5">
                  1. Mở trang <code className="text-blue-800 bg-white px-1 py-0.5 rounded border border-blue-200">dkmh.hcmute.edu.vn</code> và đăng nhập.<br />
                  2. Nhấn F12 chọn tab Console -&gt; Copy &amp; dán script bên dưới -&gt; Nhấn Enter.
                </p>
              </div>
            </div>
            <button
              onClick={copyConsoleSnippet}
              className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-xs flex items-center gap-1"
            >
              {copiedScript ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
              <span>{copiedScript ? 'Đã copy Script!' : 'Copy Script Console'}</span>
            </button>
          </div>
        </div>

        {/* Textarea Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-700">Dán chuỗi JSON vào đây:</label>
            <button
              onClick={handlePasteClipboard}
              className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
            >
              <Clipboard className="h-3.5 w-3.5" />
              <span>Tự động dán từ Clipboard</span>
            </button>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setError(''); }}
            rows={8}
            placeholder='{\n  "token": "eyJhbGciOiJIUzI1Ni...",\n  "studyProgramId": "24110",\n  "turnId": "81",\n  "apiKey": "pscRBF0zT2Mqo6v...",\n  ...\n}'
            className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
          >
            Áp Dụng Cấu Hình
          </button>
        </div>
      </div>
    </div>
  );
}
