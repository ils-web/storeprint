import React, { useEffect } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AuthSession } from './types/multiTenant';
import { saveAuthSession, fetchTenantsFromFirestore } from './services/multiTenantDb';

export default function LandingApp() {
  useEffect(() => {
    fetchTenantsFromFirestore().catch(console.warn);
  }, []);
  const getBasePath = () => {
    if (typeof window === 'undefined') return './';
    const origin = window.location.origin;
    const cleanPath = window.location.pathname
      .replace(/\/index\.html$/i, '')
      .replace(/\/landing(\.html)?$/i, '')
      .replace(/\/order(\.html)?$/i, '')
      .replace(/\/stock(\.html)?$/i, '')
      .replace(/\/$/, '');
    return `${origin}${cleanPath}`;
  };

  const handleLoginSuccess = (session: AuthSession) => {
    saveAuthSession(session);
    const base = getBasePath();
    if (session.userRole === 'superadmin') {
      window.location.href = `${base}/index.html?view=superadmin`;
    } else if (session.tenantId) {
      window.location.href = `${base}/index.html?tenant=${encodeURIComponent(session.tenantId)}`;
    } else {
      window.location.href = `${base}/index.html`;
    }
  };

  const handleOpenOrderPortal = () => {
    const base = getBasePath();
    window.location.href = `${base}/order.html`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white" dir="rtl">
      <LandingPage
        onLoginSuccess={handleLoginSuccess}
        onOpenOrderPortal={handleOpenOrderPortal}
      />
    </div>
  );
}
