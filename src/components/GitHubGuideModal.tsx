import React from 'react';
import { X, Github, Terminal, Zap, Shield, FileCheck, Copy, Check } from 'lucide-react';

interface GitHubGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubGuideModal: React.FC<GitHubGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const cloneCmd = `git clone https://github.com/ils-web/storeprint.git
cd storeprint
npm install
npm run dev`;

  const handleCopy = () => {
    navigator.clipboard.writeText(cloneCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-slate-800 text-sky-400 rounded-lg border border-slate-700">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Быстрый запуск & GitHub Репозиторий</h2>
              <p className="text-xs text-slate-400">
                Репозиторий: <code className="text-sky-300">ils-web/storeprint</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-900 text-sm">Официальный репозиторий:</div>
              <a
                href="https://github.com/ils-web/storeprint"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 font-mono text-xs hover:underline"
              >
                https://github.com/ils-web/storeprint
              </a>
            </div>
            <a
              href="https://github.com/ils-web/storeprint"
              target="_blank"
              rel="noreferrer"
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Перейти</span>
            </a>
          </div>

          {/* Terminal Command Box */}
          <div className="space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-sky-600" />
                <span>Команды для терминала (локальный запуск за 1 минуту):</span>
              </span>
              <button
                onClick={handleCopy}
                className="text-sky-600 hover:text-sky-700 flex items-center gap-1 text-[11px] font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>
            <pre className="bg-slate-900 text-sky-300 font-mono p-3.5 rounded-xl text-xs overflow-x-auto leading-relaxed border border-slate-800">
              {cloneCmd}
            </pre>
          </div>

          {/* Features Checklist */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Реализованный функционал в соответствии с ТЗ:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-1">
              <li className="flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Фильтр текущей недели:</strong> Исключает любые заявки прошлых и будущих недель.</span>
              </li>
              <li className="flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Защита от изменений:</strong> Исходная таблица открывается строго в режиме чтения.</span>
              </li>
              <li className="flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Печать в 1 клик:</strong> Одиночные и массовые отправки на любой принтер (A4, A5, 100x150, 80мм).</span>
              </li>
              <li className="flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Автообновление:</strong> Мониторинг поступления новых заявок с обратным отсчетом.</span>
              </li>
              <li className="flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Интерактивная маркировка:</strong> Чекбоксы [ ☐ ] для сборки товаров на бумаге или экране.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
