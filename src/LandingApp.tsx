import React from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AuthSession } from './types/multiTenant';
import { saveAuthSession } from './services/multiTenantDb';

export default function LandingApp() {
  const handleLoginSuccess = (session: AuthSession) => {
    saveAuthSession(session);
    if (session.userRole === 'superadmin') {
      window.location.href = './index.html?view=superadmin';
    } else if (session.tenantId) {
      window.location.href = `./index.html?tenant=${encodeURIComponent(session.tenantId)}`;
    } else {
      window.location.href = './index.html';
    }
  };

  const handleOpenOrderPortal = () => {
    window.location.href = './order.html';
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
