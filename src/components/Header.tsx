import React from 'react';
import { RefreshCw, ShieldCheck, FileSpreadsheet, Github, Clock, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { WeekRange } from '../types';

interface HeaderProps {
  sheetUrl: string;
  activeSheetTitle: string;
  weekRange: WeekRange;
  isLoggedIn: boolean;
  onGoogleSignIn: () => void;
  autoRefreshSec: number;
  setAutoRefreshSec: (sec: number) => void;
  countdown: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  onOpenGitHubGuide: () => void;
  ordersCount: number;
  filteredOutCount: number;
  lastUpdated: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  sheetUrl,
  activeSheetTitle,
  weekRange,
  isLoggedIn,
  onGoogleSignIn,
  autoRefreshSec,
  setAutoRefreshSec,
  countdown,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  onOpenGitHubGuide,
  ordersCount,
  filteredOutCount,
  lastUpdated,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & GitHub Link */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-sky-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-sky-500/20 text-white">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                    StorePrint
                  </h1>
                  <span className="bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    Печать заказов
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Режим: <strong>Только чтение</strong> (без изменений в Google Sheets)</span>
                </p>
              </div>
            </div>

            <button
              onClick={onOpenGitHubGuide}
              className="lg:hidden text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </button>
          </div>

          {/* Current Week Filter Info */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Фильтр по текущей неделе:</span>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-md">
                {weekRange.formattedRange}
              </span>
            </div>

            <div className="text-xs text-slate-300 flex items-center gap-2">
              <span className="text-slate-400">Вкладка:</span>
              <span className="font-semibold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                {activeSheetTitle || 'Заявки'}
              </span>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
                title="Открыть Google Таблицу"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Actions & Auto-refresh Controls */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Auto Refresh Toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <span className="text-slate-400 mr-1.5">Автообновление:</span>
              <select
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 font-medium focus:outline-none focus:border-sky-500"
              >
                <option value={0}>Выкл</option>
                <option value={15}>15 сек</option>
                <option value={30}>30 сек</option>
                <option value={60}>1 мин</option>
                <option value={300}>5 мин</option>
              </select>
              {autoRefreshSec > 0 && (
                <span className="text-sky-400 font-mono font-semibold ml-2 mr-1">
                  {countdown}s
                </span>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>

            {/* Google OAuth Login Button */}
            {!isLoggedIn ? (
              <button
                onClick={onGoogleSignIn}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow flex items-center gap-1.5 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google Вход</span>
              </button>
            ) : (
              <span className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Подключен</span>
              </span>
            )}

            {/* GitHub Repo Button */}
            <button
              onClick={onOpenGitHubGuide}
              className="hidden lg:flex text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg items-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5 text-slate-300" />
              <span>ils-web/storeprint</span>
            </button>
          </div>
        </div>

        {/* Sub-bar with active status */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span>Заказов текущей недели: <strong className="text-emerald-400 font-bold">{ordersCount}</strong></span>
            <span>•</span>
            <span>Исключено за пределами недели: <strong className="text-amber-400 font-medium">{filteredOutCount}</strong></span>
          </div>
          {lastUpdated && (
            <div className="text-slate-500">
              Обновлено: {lastUpdated.toLocaleTimeString('ru-RU')}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
