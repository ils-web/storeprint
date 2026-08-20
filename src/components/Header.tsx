import React from 'react';
import {
  RefreshCw,
  ShieldCheck,
  FileSpreadsheet,
  ExternalLink,
  Printer,
  Package,
  AlertTriangle,
  Layers,
  Building2,
  Smartphone,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { AuthSession } from '../types/multiTenant';

interface HeaderProps {
  sheetUrl: string;
  activeSheetTitle: string;
  activeTab: 'orders' | 'warehouse' | 'order_portal';
  setActiveTab: (tab: 'orders' | 'warehouse' | 'order_portal') => void;
  autoRefreshSec: number;
  setAutoRefreshSec: (sec: number) => void;
  countdown: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  ordersCount: number;
  departmentsCount: number;
  lowStockCount: number;
  lastUpdated: Date | null;
  authSession?: AuthSession | null;
  onOpenSuperadmin?: () => void;
  onOpenLanding?: () => void;
  onOpenPortalPwa?: () => void;
  onLogout?: () => void;
  tenantName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  sheetUrl,
  activeSheetTitle,
  activeTab,
  setActiveTab,
  autoRefreshSec,
  setAutoRefreshSec,
  countdown,
  onRefresh,
  isRefreshing,
  ordersCount,
  departmentsCount,
  lowStockCount,
  lastUpdated,
  authSession,
  onOpenSuperadmin,
  onOpenLanding,
  onOpenPortalPwa,
  onLogout,
  tenantName,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-30" dir="rtl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          
          {/* Logo & Main Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
            
            {/* Logo & Tenant badge */}
            <div className="flex items-center space-x-reverse space-x-2.5">
              <div className="bg-gradient-to-tr from-sky-500 to-indigo-600 p-2 sm:p-2.5 rounded-xl shadow-lg shadow-sky-500/20 text-white">
                <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                    StorePrint
                  </h1>
                  <span className="bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                    {tenantName || 'הדפסה ומלאי'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>קיזוז ובקרת מלאי אוטומטית</span>
                </p>
              </div>
            </div>

            {/* Navigation Tabs (Orders / Warehouse / Department Order) */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700/80">
              
              {/* Tab 1: Orders */}
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>הזמנות מחלקות</span>
                <span className="bg-slate-900/60 text-sky-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {ordersCount}
                </span>
              </button>

              {/* Tab 2: Warehouse */}
              <button
                onClick={() => setActiveTab('warehouse')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'warehouse'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>מחסן ומלאי</span>
                {lowStockCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{lowStockCount}</span>
                  </span>
                )}
              </button>

              {/* Tab 3: Department Order Portal */}
              <button
                onClick={() => setActiveTab('order_portal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'order_portal'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-emerald-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>📝 פורטל הזמנות</span>
              </button>

            </div>

          </div>

          {/* Right Toolbar: Auto-refresh, Refresh, Multi-tenant Links */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            
            {/* PWA Order Portal quick link */}
            {onOpenPortalPwa && (
              <button
                onClick={onOpenPortalPwa}
                className="bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border border-indigo-500/30 cursor-pointer"
                title="פתח פורטל הזמנות למובייל (PWA)"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-200" />
                <span className="hidden md:inline">פורטל מובייל PWA</span>
              </button>
            )}

            {/* SuperAdmin Panel link */}
            {onOpenSuperadmin && (
              <button
                onClick={onOpenSuperadmin}
                className="bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border border-purple-500/30 cursor-pointer"
                title="פאנל סופר-אדמין לניהול סניפים"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                <span className="hidden md:inline">סופר-אדמין</span>
              </button>
            )}

            {/* Auto-Refresh Control */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1 text-[11px] sm:text-xs text-slate-300 gap-1.5">
              <span className="text-slate-400">רענון:</span>
              <select
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                <option value={0}>כבוי</option>
                <option value={15}>15 שנ'</option>
                <option value={30}>30 שנ'</option>
                <option value={60}>1 דק'</option>
                <option value={300}>5 דק'</option>
              </select>
              {autoRefreshSec > 0 && (
                <span className="text-[10px] font-mono text-slate-400 w-4">
                  {countdown}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Refresh Button */}
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'מרענן...' : 'רענן'}</span>
              </button>

              {/* Google Sheets Link */}
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-colors"
                title="פתח טבלת הזמנות מקורית ב-Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">טבלה</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              {/* Logout / Switch */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="התנתק / דף ראשי"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
