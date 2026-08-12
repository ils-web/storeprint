import React from 'react';
import { RefreshCw, ShieldCheck, FileSpreadsheet, ExternalLink, Printer } from 'lucide-react';

interface HeaderProps {
  sheetUrl: string;
  activeSheetTitle: string;
  autoRefreshSec: number;
  setAutoRefreshSec: (sec: number) => void;
  countdown: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  ordersCount: number;
  departmentsCount: number;
  lastUpdated: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  sheetUrl,
  activeSheetTitle,
  autoRefreshSec,
  setAutoRefreshSec,
  countdown,
  onRefresh,
  isRefreshing,
  ordersCount,
  departmentsCount,
  lastUpdated,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-sky-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-sky-500/20 text-white">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  StorePrint
                </h1>
                <span className="bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  Печать заявок отделений
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Прямое чтение Google Таблицы (столбцы E..FM)</span>
              </p>
            </div>
          </div>

          {/* Stats & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Stats Badges */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs">
              <div>
                <span className="text-slate-400">Всего заказов:</span>{' '}
                <strong className="text-emerald-400 font-bold">{ordersCount}</strong>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div>
                <span className="text-slate-400">Отделений:</span>{' '}
                <strong className="text-sky-300 font-bold">{departmentsCount}</strong>
              </div>
            </div>

            {/* Auto-Refresh control */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 gap-2">
              <span className="text-slate-400">Автообновление:</span>
              <select
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-semibold text-sky-400 focus:outline-none cursor-pointer"
              >
                <option value={0}>Выкл</option>
                <option value={15}>15 сек</option>
                <option value={30}>30 сек</option>
                <option value={60}>1 мин</option>
                <option value={300}>5 мин</option>
              </select>
              {autoRefreshSec > 0 && (
                <span className="text-[11px] font-mono text-slate-400 w-5">
                  {countdown}s
                </span>
              )}
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Загрузка...' : 'Обновить'}</span>
            </button>

            {/* Google Sheet Direct Link */}
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              title="Открыть исходную таблицу Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Таблица</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>

        </div>
      </div>
    </header>
  );
};
