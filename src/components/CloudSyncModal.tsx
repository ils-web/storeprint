import React, { useState } from 'react';
import { X, Cloud, RefreshCw, Copy, Check, ExternalLink, HelpCircle, ShieldCheck, FileSpreadsheet, PlusCircle, AlertCircle, UploadCloud } from 'lucide-react';
import { CloudSyncConfig } from '../types';
import { generateGoogleAppsScriptCode, testCloudConnection, normalizeCloudUrl } from '../utils/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CloudSyncConfig;
  totalItemsCount?: number;
  onSaveConfig: (newConfig: CloudSyncConfig) => void;
  onSyncNow?: () => Promise<boolean>;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  totalItemsCount = 187,
  onSaveConfig,
  onSyncNow,
}) => {
  const [localConfig, setLocalConfig] = useState<CloudSyncConfig>(config);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string>('');
  const [connectedSheetUrl, setConnectedSheetUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const scriptCode = generateGoogleAppsScriptCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleTest = async () => {
    const rawUrl = localConfig.endpointUrl.trim();
    if (!rawUrl) {
      setTestResult('error');
      setTestErrorMessage('נא להדביק תחילה את כתובת ה-Web App בשדה למעלה');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestErrorMessage('');

    try {
      const res = await testCloudConnection(rawUrl);
      if (res.success) {
        setTestResult('success');
        if (res.sheetUrl) setConnectedSheetUrl(res.sheetUrl);
        setLocalConfig((prev) => ({
          ...prev,
          endpointUrl: normalizeCloudUrl(rawUrl),
          enabled: true,
        }));
      } else {
        setTestResult('error');
        setTestErrorMessage(res.message || 'שגיאת חיבור');
      }
    } catch (err: any) {
      setTestResult('error');
      setTestErrorMessage(err.message || 'שגיאת רשת');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = normalizeCloudUrl(localConfig.endpointUrl);
    const updated: CloudSyncConfig = {
      ...localConfig,
      endpointUrl: cleanUrl,
      enabled: cleanUrl.length > 0,
    };
    onSaveConfig(updated);
    onClose();
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
                טבלת ההזמנות של המחלקות <strong>אינה משתנה כלל</strong>.  
                הסקריפט יוצר אוטומטית טבלה חדשה בשם <strong>"StorePrint - ניהול מלאי ומחסן"</strong> ב-Google Drive שלכם!
              </div>
            </div>
          </div>

          {/* Endpoint URL Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 block text-xs">
              כתובת ה-Web App של טבלת המחסן (URL שמסתיים ב-/exec):
            </label>
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={localConfig.endpointUrl}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, endpointUrl: e.target.value });
                setTestResult(null);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 ltr"
              dir="ltr"
            />
          </div>

          {/* Test Connection Button & Status */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !localConfig.endpointUrl}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'בודק חיבור...' : 'בדיקת חיבור לטבלת המחסן'}</span>
              </button>

              {testResult === 'success' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-emerald-800 bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>החיבור לטבלת המחסן תקין ומסונכרן בהצלחה! 🎉</span>
                  </span>
                  {connectedSheetUrl && (
                    <a
                      href={connectedSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-700 font-bold underline flex items-center gap-1 hover:text-sky-900"
                    >
                      <span>פתח את טבלת המחסן החדשה</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {testResult === 'error' && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1.5 animate-shake">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>שגיאה בחיבור:</span>
                </div>
                <div className="text-xs leading-relaxed pr-5 font-medium">
                  {testErrorMessage}
                </div>
                <div className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-lg border border-red-100 pr-3 space-y-1">
                  <div><strong>צעד קריטי ב-Apps Script:</strong></div>
                  <div>בחלון ניהול הפריסות (ניהול הפריסות / Manage deployments) לחצו על הכפתור הכחול <strong>לפריסה (Deploy)</strong> בפינה השמאלית התחתונה כדי שהשרת יפרסם את השינויים!</div>
                </div>
              </div>
            )}
          </div>

          {/* Step-by-step Setup Guide */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-sky-600" />
              <span>הקוד המעודכן (סקריפט אוניברסלי שיוצר טבלה אוטומטית)</span>
            </div>

            <div className="p-4 bg-white space-y-3">
              <p className="text-slate-600 font-medium leading-relaxed">
                העתק את הקוד המעודכן הבא והדבק אותו בעורך ה-Apps Script:
              </p>

              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36" dir="ltr">
                  {scriptCode}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-2 left-2 bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'הועתק!' : 'העתק קוד מעודכן'}</span>
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium leading-relaxed pt-1">
                <li>הדביקו ושמרו את הקוד (Ctrl + S).</li>
                <li>לחצו <strong>Deploy (פריסה) ➔ Manage deployments (ניהול פריסות)</strong>.</li>
                <li>ודאו ש-<em>Execute as</em> הוא <strong>עצמי</strong>, ו-<em>Who has access</em> הוא <strong>כולם</strong>.</li>
                <li><strong>חשוב מאוד:</strong> לחצו על הכפתור הכחול <strong>לפריסה (Deploy)</strong> בפינה התחתונה!</li>
                <li>העתיקו את הקישור שהתקבל והדביקו כאן.</li>
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
            disabled={!localConfig.endpointUrl}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition-all transform active:scale-95 cursor-pointer"
          >
            שמור והפעל סנכרון ענן
          </button>
        </div>

      </div>
    </div>
  );
};
