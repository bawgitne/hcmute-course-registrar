import React from 'react';
import { Play, Square, ClipboardPaste, Activity, AlertCircle, Sun } from 'lucide-react';

export function Header({ isRunning, onStart, onStop, onOpenImport, hasToken, userId, userName }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">HCMUTE API REGISTRAR</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">LIGHT EDITION</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Đăng ký Lớp học phần HCMUTE</h1>
          </div>
        </div>

        {/* User Auth Quick Badge */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
          {hasToken ? (
            <>
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <span className="text-slate-500">Đã kết nối: </span>
                <span className="font-semibold text-slate-800">{userId || 'MSSV'} {userName ? `(${userName})` : ''}</span>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Chưa có Session Token</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shadow-xs"
          >
            <ClipboardPaste className="h-4 w-4 text-blue-600" />
            <span>Dán JSON Cấu Hình</span>
          </button>

          {isRunning ? (
            <button
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/20 transition-all hover:bg-rose-500 active:scale-95"
            >
              <Square className="h-4 w-4 fill-white" />
              <span>Dừng Chạy</span>
            </button>
          ) : (
            <button
              onClick={onStart}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-95"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Bắt Đầu Chạy</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
