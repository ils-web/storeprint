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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-2xl border border-sky-500/30 shrink-0">
              <Cloud className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                חיבור טבלת מחסן נפרדת בענן (Google Sheets)
              </h2>
              <p className="text-sm text-slate-300 font-medium mt-0.5">
                שמירת יתרות המלאי בטבלה ייעודית בענן — ללא פגיעה בטבלת ההזמנות המקורית
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-6 text-sm sm:text-base max-h-[75vh] overflow-y-auto">
          
          {/* Endpoint Input & Test Section */}
          <div className="space-y-4 p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl">
            <label className="font-black text-slate-900 block text-sm sm:text-base">
              כתובת ה-Web App של Google Apps Script (מסתיים ב-<code>/exec</code>):
            </label>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={localConfig.endpointUrl}
                onChange={(e) => setLocalConfig({ ...localConfig, endpointUrl: e.target.value })}
                className="flex-1 bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:outline-none focus:border-sky-500 shadow-inner"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer text-sm shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'בודק...' : 'בדוק חיבור'}</span>
              </button>
            </div>

            {/* Test Result Message */}
            {testResult === 'success' && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl animate-fadeIn">
                <span className="text-emerald-800 font-black text-sm flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>החיבור לטבלת המחסן תקין ומסונכרן בהצלחה! 🎉</span>
                </span>
                {connectedSheetUrl && (
                  <a
                    href={connectedSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-sky-700 font-bold underline flex items-center gap-1.5 hover:text-sky-900"
                  >
                    <span>פתח את טבלת המחסן החדשה</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {testResult === 'error' && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 space-y-2 animate-shake">
                <div className="font-black text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>שגיאה בחיבור:</span>
                </div>
                <div className="text-sm leading-relaxed pr-6 font-medium">
                  {testErrorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Quick Phone Connect QR Code & Share Link */}
          {localConfig.endpointUrl && (
            <div className="p-5 bg-sky-50 border-2 border-sky-200 rounded-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black text-base text-sky-900 flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-sky-600" />
                  <span>חיבור מהיר של הטלפון הנייד (סריקה ב-1 קליק)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="text-xs sm:text-sm bg-white border border-sky-300 text-sky-800 font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-sky-100 cursor-pointer shadow-2xs"
                >
                  {copiedShareLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedShareLink ? 'הועתק!' : 'העתק קישור לטלפון'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-sky-100">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  className="w-32 h-32 rounded-xl border-2 border-slate-200 shadow-sm shrink-0"
                />
                <div className="text-sm text-slate-700 space-y-2">
                  <p className="font-black text-slate-900 text-base">
                    פתחו את מצלמת הטלפון וסרקו את קוד ה-QR:
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    הטלפון ייפתח מיד כשהוא מחובר ישירות לאותה טבלת ענן, וכל היתרות והמוצרים יופיעו במלואם ללא צורך בהקלדה ידנית!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-step Setup Guide */}
          <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2.5 text-base">
              <PlusCircle className="w-5 h-5 text-sky-600" />
              <span>קוד ה-Apps Script המעודכן (יוצר טבלה אוטומטית)</span>
            </div>

            <div className="p-5 bg-white space-y-4">
              <p className="text-sm text-slate-700 font-medium leading-relaxed">
                העתק את הקוד המעודכן הבא והדבק אותו בעורך ה-Apps Script:
              </p>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-48 border border-slate-800 text-left" dir="ltr">
                  {scriptCode}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-3 right-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'הועתק!' : 'העתק קוד'}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-sm transition-colors cursor-pointer"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-2xl text-base shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Cloud className="w-5 h-5" />
            <span>שמור והפעל סנכרון</span>
          </button>
        </div>

      </div>
    </div>
  );
};
