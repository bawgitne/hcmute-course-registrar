import React, { useState } from 'react';
import { Trash2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export function LogTable({ logs, onClearLogs }) {
  const [expandedLog, setExpandedLog] = useState(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            05
          </span>
          <h2 className="text-sm font-bold text-slate-900">Nhật Ký API Thời Gian Thực</h2>
        </div>

        <button
          onClick={onClearLogs}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Xóa Nhật Ký</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 bg-slate-50/50">
          Chưa có yêu cầu API nào được gửi. Khởi chạy vòng lặp để theo dõi nhật ký.
        </div>
      ) : (
        <div className="max-h-[350px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Thời gian</th>
                <th className="px-3 py-2.5">Mã môn</th>
                <th className="px-3 py-2.5">Bước</th>
                <th className="px-3 py-2.5">Kết quả</th>
                <th className="px-3 py-2.5">Phản hồi</th>
                <th className="px-3 py-2.5">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-800 font-mono">
              {logs.map((log, index) => {
                const isExpanded = expandedLog === index;
                const isOk = log.ok;

                return (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500 text-[11px]">{log.time}</td>
                      <td className="px-3 py-2 font-bold text-blue-700">{log.code}</td>
                      <td className="px-3 py-2 text-slate-900 font-sans">{log.step}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isOk ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 font-sans">
                            <CheckCircle2 className="h-3 w-3" /> HTTP {log.status || 200}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-semibold text-rose-800 font-sans">
                            <XCircle className="h-3 w-3" /> HTTP {log.status || 0}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 line-clamp-1 max-w-[300px] font-sans">{log.response}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpandedLog(isExpanded ? null : index)}
                          className="p-1 text-slate-500 hover:text-slate-900"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 p-3">
                          <pre className="text-[11px] text-slate-800 overflow-x-auto p-2.5 rounded-lg bg-white border border-slate-200">
                            {JSON.stringify(log.data || log, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
