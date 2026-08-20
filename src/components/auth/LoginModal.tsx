import React, { useState } from 'react';
import { AuthSession } from '../../types/multiTenant';
import { authenticate, getTenants, SUPERADMIN_CREDENTIALS } from '../../services/multiTenantDb';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  ArrowLeft,
  AlertCircle,
  Key,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  onOpenOrderPortal?: (tenantId?: string) => void;
}

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  onOpenOrderPortal,
}: LoginModalProps) {
  const [activeTab, setActiveTab] = useState<'tenant' | 'superadmin'>('tenant');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const session = authenticate(login, password);
      if (session) {
        onSuccess(session);
        onClose();
      } else {
        setErrorMessage('שם משתמש או סיסמה שגויים. אנא נסה שוב.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאת אימות');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSuperadmin = () => {
    setLogin(SUPERADMIN_CREDENTIALS.login);
    setPassword(SUPERADMIN_CREDENTIALS.password);
    setActiveTab('superadmin');
  };

  const handleQuickTenant = () => {
    const tenants = getTenants();
    if (tenants.length > 0) {
      setLogin(tenants[0].login);
      setPassword(tenants[0].passwordHash);
      setActiveTab('tenant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 pb-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">כניסה למערכת StorePrint</h3>
              <p className="text-xs text-slate-400">פלטפורמה מרכזית לניהול מלאי</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Role Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('tenant');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'tenant'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              כניסה לסניף
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('superadmin');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'superadmin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              סופר-אדמין
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {activeTab === 'tenant' ? 'שם משתמש סניף' : 'שם משתמש סופר-אדמין'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={activeTab === 'tenant' ? 'center1' : 'admin'}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">סיסמה</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>כניסה למערכת</span>
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Quick Demo Pre-fill helpers */}
          <div className="pt-3 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-500 text-center mb-2">כניסת הדגמה מהירה (בדיקה):</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleQuickTenant}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Building2 className="w-3 h-3 text-indigo-400" />
                <span>סניף ראשי</span>
              </button>

              <button
                type="button"
                onClick={handleQuickSuperadmin}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>סופר-אדמין</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
