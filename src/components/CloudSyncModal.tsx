import React, { useState } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  FileSpreadsheet,
  PlusCircle,
  AlertCircle,
  UploadCloud,
  Smartphone,
  QrCode,
} from 'lucide-react';
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
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  if (!isOpen) return null;

  const scriptCode = generateGoogleAppsScriptCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const shareUrl = localConfig.endpointUrl
    ? `https://ils-web.github.io/storeprint/?cloudUrl=${encodeURIComponent(localConfig.endpointUrl)}`
    : '';

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 3000);
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

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          
          {/* Endpoint Input & Test Section */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="font-black text-slate-900 block text-xs">
              כתובת ה-Web App של Google Apps Script (מסתיים ב-<code>/exec</code>):
            </label>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={localConfig.endpointUrl}
                onChange={(e) => setLocalConfig({ ...localConfig, endpointUrl: e.target.value })}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'בודק...' : 'בדוק חיבור'}</span>
              </button>
            </div>

            {/* Test Result Message */}
            <div>
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
              </div>
            )}
          </div>

          {/* Quick Phone Connect QR Code & Share Link */}
          {localConfig.endpointUrl && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-black text-xs text-sky-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-600" />
                  <span>חיבור מהיר של הטלפון הנייד (סריקה ב-1 קליק)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="text-[11px] bg-white border border-sky-300 text-sky-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-sky-100 cursor-pointer shadow-2xs"
                >
                  {copiedShareLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedShareLink ? 'הועתק!' : 'העתק קישור לטלפון'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-sky-100">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  className="w-28 h-28 rounded-lg border border-slate-200 shadow-2xs shrink-0"
                />
                <div className="text-xs text-slate-700 space-y-1.5">
                  <p className="font-bold text-slate-900">
                    פתחו את מצלמת הטלפון וסרקו את קוד ה-QR:
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    הטלפון ייפתח מיד כשהוא מחובר ישירות לאותה טבלת ענן, וכל היתרות והמוצרים יופיעו במלואם ללא צורך בהקלדה ידנית!
                  </p>
                </div>
              </div>
            </div>
          )}

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
                <li>ודאו ש-<em>Execute as</em> הוא <strong>עצמי (Me)</strong>, ו-<em>Who has access</em> הוא <strong>כולם (Anyone)</strong>.</li>
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
