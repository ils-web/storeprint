import React, { useState } from 'react';
import { X, Cloud, RefreshCw, Copy, Check, ExternalLink, HelpCircle, ShieldCheck, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { CloudSyncConfig } from '../types';
import { generateGoogleAppsScriptCode } from '../utils/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CloudSyncConfig;
  onSaveConfig: (newConfig: CloudSyncConfig) => void;
  onTestSync: () => Promise<boolean>;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTestSync,
}) => {
  const [localConfig, setLocalConfig] = useState<CloudSyncConfig>(config);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  if (!isOpen) return null;

  const scriptCode = generateGoogleAppsScriptCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      onSaveConfig(localConfig);
      const ok = await onTestSync();
      setTestResult(ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-reverse space-x-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                חיבור טבלת מחסן נפרדת בענן (Google Sheets)
              </h2>
              <p className="text-xs text-slate-400">
                שמירת יתרות המלאי בטבלה חדשה ונפרדת — ללא נגיעה בטבלת ההזמנות המקורית!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          
          {/* Strict Separation Guarantee Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-extrabold text-sm text-emerald-950">
                הגנה מלאה: טבלת ההזמנות נשארת לקריאה בלבד
              </div>
              <div className="text-emerald-800 text-xs leading-relaxed">
                טבלת ההזמנות של המחלקות (1NJq4sJV0...) <strong>אינה משתנה כלל</strong>.  
                עבור המלאי פותחים <strong>טבלת Google Sheets חדשה ונקייה</strong> משלכם, והאפליקציה תסנכרן את יתרות המלאי לשם בלבד.
              </div>
            </div>
          </div>

          {/* Toggle Enable */}
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-extrabold text-sm text-sky-950">סנכרון אוטומטי מול טבלת המחסן החדשה</div>
              <div className="text-slate-600 text-xs">
                טעינת יתרות בעת פתיחה, וקיזוז אוטומטי מהטבלה החדשה בעת כל הדפסה
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.enabled}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Endpoint URL Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 block text-xs">
              כתובת ה-Web App של טבלת המחסן החדשה (URL):
            </label>
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={localConfig.endpointUrl}
              onChange={(e) => setLocalConfig({ ...localConfig, endpointUrl: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 ltr"
              dir="ltr"
            />
            <p className="text-[11px] text-slate-400">
              הדביקו כאן את הקישור שנוצר מה-Apps Script בטבלת המחסן החדשה שלכם
            </p>
          </div>

          {/* Test Connection Button & Status */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={isTesting || !localConfig.endpointUrl}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-xl flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'בודק חיבור...' : 'בדיקת חיבור לטבלת המחסן'}</span>
            </button>

            {testResult === 'success' && (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>החיבור לטבלת המחסן תקין ומסונכרן!</span>
              </span>
            )}

            {testResult === 'error' && (
              <span className="text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl font-bold">
                ⚠️ שגיאה בחיבור לקישור
              </span>
            )}
          </div>

          {/* Step-by-step Setup Guide */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-sky-600" />
              <span>מדריך מהיר: יצירת טבלת המחסן החדשה ב-2 דקות</span>
            </div>

            <div className="p-4 bg-white space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium leading-relaxed">
                <li>
                  פתחו <strong>Google Sheets חדש ונקי</strong> (קראו לו למשל: <em>StorePrint - ניהול מלאי</em>).
                </li>
                <li>
                  בתפריט העליון של הטבלה החדשה לחצו: <strong>הרחבות (Extensions) ➔ Apps Script</strong>.
                </li>
                <li>
                  מחקו את הקוד שמופיע שם, והדביקו את הקוד הבא:
                </li>
              </ol>

              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40" dir="ltr">
                  {scriptCode}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 left-2 bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'הועתק!' : 'העתק קוד'}</span>
                </button>
              </div>

              <ol start={4} className="list-decimal list-inside space-y-2 text-slate-700 font-medium leading-relaxed pt-1">
                <li>
                  ב-Apps Script לחצו בפינה הימנית העליונה על <strong>Deploy (פריסה) ➔ New deployment (פריסה חדשה)</strong>.
                </li>
                <li>
                  בחרו סוג <strong>Web App</strong>, תנו שם, ובשדה <em>Who has access</em> בחרו <strong>Anyone (כולם)</strong>.
                </li>
                <li>
                  לחצו <strong>Deploy</strong>, העתיקו את כתובת ה-Web App URL שקיבלתם והדביקו אותה בשדה למעלה!
                </li>
              </ol>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            סגור
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition-all transform active:scale-95 cursor-pointer"
          >
            שמור והפעל סנכרון
          </button>
        </div>

      </div>
    </div>
  );
};
