import React, { useState } from 'react';
import {
  Building2,
  Package,
  Printer,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Smartphone,
  Layers,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { LoginModal } from '../auth/LoginModal';
import { AuthSession } from '../../types/multiTenant';
import { BILLING_PLANS } from '../../services/multiTenantDb';

interface LandingPageProps {
  onLoginSuccess: (session: AuthSession) => void;
  onOpenOrderPortal: () => void;
}

export function LandingPage({ onLoginSuccess, onOpenOrderPortal }: LandingPageProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">StorePrint</span>
              <span className="ml-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                Multi-Tenant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenOrderPortal}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-700/80 transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Портал заказа (PWA)</span>
            </button>

            <button
              onClick={() => setIsLoginOpen(true)}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <span>Войти в систему</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-purple-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-indigo-300 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Мультитенантная платформа складского учёта и заказов отделений</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Склад — Заказ — Склад <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              для сетей клиник и филиалов
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Централизованный контроль складов филиалов, автоматический учет видов упаковок (штуки, пачки, коробки, ящики), PWA-портал заказа для персонала и мгновенная печать накладных.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setIsLoginOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-base font-bold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Building2 className="w-5 h-5" />
              <span>Вход для филиалов и Суперадмина</span>
            </button>

            <button
              onClick={onOpenOrderPortal}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-2xl text-base font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Smartphone className="w-5 h-5 text-purple-400" />
              <span>Демо-портал заказа отделения</span>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 px-6 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Ключевые преимущества платформы</h2>
            <p className="text-sm text-slate-400 mt-2">
              Архитектура построена для максимальной гибкости, безопасности данных и простоты использования.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Учёт видов упаковок</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Штуки, пачки, коробки, ящики/картон. Персонал заказывает в понятных единицах, склад списывает с точностью до штуки.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Google Forms & Таблицы</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Полная параллельность: привычные Google Формы продолжают работать без сбоев, данные объединяются в единой базе.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Пакетная печать PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Генерация накладных и маркировочных стикеров в форматах A4, A5, рулоны 80мм. Автоматический расчет дозаказа.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Панель Суперадмина</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Управление филиалами (логин/пароль), централизованная настройка складов, тарифы и готовность к онлайн-оплате.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Тарифные планы</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">Готовые подписки для любого масштаба</h2>
            <p className="text-sm text-slate-400 mt-2">
              Подключение новых филиалов с гибким управлением лимитами и складами.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(BILLING_PLANS).map((plan) => (
              <div
                key={plan.id}
                className={`bg-slate-900/90 border rounded-3xl p-6 flex flex-col justify-between relative shadow-xl ${
                  plan.id === 'pro'
                    ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>

                  <div className="my-5">
                    <span className="text-3xl font-black text-white">${plan.priceMonthlyUsd}</span>
                    <span className="text-xs text-slate-400"> / мес</span>
                  </div>

                  <div className="space-y-2.5 border-t border-slate-800 pt-5 text-xs text-slate-300">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setIsLoginOpen(true)}
                  className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    plan.id === 'pro'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                  }`}
                >
                  Выбрать план
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 StorePrint Multi-Tenant Platform. Все права защищены.</p>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={onLoginSuccess}
        onOpenOrderPortal={onOpenOrderPortal}
      />
    </div>
  );
}
