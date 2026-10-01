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
  X,
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
    setErrorMessage(null);
    try {
      const session = authenticate(SUPERADMIN_CREDENTIALS.login, SUPERADMIN_CREDENTIALS.password);
      if (session) {
        onSuccess(session);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאת אימות');
    }
  };

  const handleQuickTenant = () => {
    const tenants = getTenants();
    const tLogin = tenants.length > 0 ? tenants[0].login : 'center1';
    const tPass = tenants.length > 0 ? tenants[0].passwordHash : 'pass123';
    setLogin(tLogin);
    setPassword(tPass);
    setActiveTab('tenant');
    setErrorMessage(null);
    try {
      const session = authenticate(tLogin, tPass);
      if (session) {
        onSuccess(session);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאת אימות');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">כניסה למערכת StorePrint</h3>
              <p className="text-sm text-slate-300 font-medium mt-0.5">פלטפורמה מרכזית לניהול מלאי והזמנות</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('tenant');
                setErrorMessage(null);
              }}
              className={`py-2.5 text-sm font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'tenant'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              כניסה לסניף / מחסן
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('superadmin');
                setErrorMessage(null);
              }}
              className={`py-2.5 text-sm font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'superadmin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              סופר-אדמין ראשי
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl flex items-center gap-3 text-sm text-rose-200 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span className="font-bold">{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              {activeTab === 'tenant' ? 'שם משתמש סניף' : 'שם משתמש סופר-אדמין'}
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={activeTab === 'tenant' ? 'center1' : 'admin'}
                className="w-full pr-12 pl-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">סיסמה</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-12 pl-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-base font-black shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
          >
            <span>כניסה למערכת</span>
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Quick Demo Pre-fill helpers */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="text-center">
              <span className="text-xs text-amber-300 font-black">⚡ כניסת הדגמה מיידית (בלחיצה אחת):</span>
              <p className="text-[11px] text-slate-400 mt-0.5">לחצו על אחד הכפתורים כדי להיכנס למערכת מיד ללא צורך בהקלדה</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleQuickTenant}
                className="py-3 px-3 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-white rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
              >
                <div className="flex items-center gap-1.5 font-black text-indigo-300">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>סניף ראשי (מחסן)</span>
                </div>
                <span className="text-[10px] text-slate-300 font-mono">center1 / pass123</span>
              </button>

              <button
                type="button"
                onClick={handleQuickSuperadmin}
                className="py-3 px-3 bg-purple-950/70 hover:bg-purple-900 border border-purple-700/60 text-white rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
              >
                <div className="flex items-center gap-1.5 font-black text-purple-300">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>סופר-אדמין (ניהול)</span>
                </div>
                <span className="text-[10px] text-slate-300 font-mono">admin / admin123</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
