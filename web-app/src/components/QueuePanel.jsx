import React from 'react';
import { PlayCircle, Clock, CheckCircle2, XCircle, Activity, Trash2, X } from 'lucide-react';

export function QueuePanel({ courses, statuses, onRunOnce, onRemoveCourse, onClearQueue }) {
  const getBadgeStyle = (kind) => {
    switch (kind) {
      case 'success':
        return { bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: CheckCircle2 };
      case 'error':
        return { bg: 'bg-rose-100 border-rose-300 text-rose-800', icon: XCircle };
      case 'working':
        return { bg: 'bg-blue-100 border-blue-300 text-blue-800', icon: Activity };
      default:
        return { bg: 'bg-slate-100 border-slate-300 text-slate-700', icon: Clock };
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            04
          </span>
          <h2 className="text-sm font-bold text-slate-900">Hàng đợi &amp; Trạng thái Theo Dõi</h2>
        </div>

        <div className="flex items-center gap-2">
          {courses.length > 0 && (
            <button
              onClick={onClearQueue}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-colors shadow-xs"
              title="Xóa tất cả môn khỏi hàng đợi"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa tất cả</span>
            </button>
          )}

          <button
            onClick={onRunOnce}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>Chạy 1 Lượt Thủ Công</span>
          </button>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 bg-slate-50/50">
          Chưa có mã môn/lớp nào trong hàng đợi. Nhập mã ở Bước 02 hoặc chọn từ danh sách ở Bước 03.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {courses.map((code) => {
            const st = statuses[code] || { label: 'Chờ kiểm tra', kind: 'idle', message: 'Đang nằm trong hàng đợi.' };
            const style = getBadgeStyle(st.kind);
            const Icon = style.icon;

            return (
              <div
                key={code}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded-md shadow-2xs">
                    {code}
                  </div>

                  <div className="text-xs text-slate-700">
                    <p className="line-clamp-1 font-medium">{st.message}</p>
                    {st.at && <span className="text-[10px] text-slate-500">{new Date(st.at).toLocaleTimeString('vi-VN')}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.bg}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{st.label}</span>
                  </div>

                  <button
                    onClick={() => onRemoveCourse(code)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                    title={`Xóa môn ${code} khỏi hàng đợi`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
