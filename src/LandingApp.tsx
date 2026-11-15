import React, { useEffect } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AuthSession } from './types/multiTenant';
import { saveAuthSession, fetchTenantsFromFirestore } from './services/multiTenantDb';
import { buildAdminUrl, buildPortalUrl } from './utils/urlUtils';

export default function LandingApp() {
  useEffect(() => {
    fetchTenantsFromFirestore().catch(console.warn);
  }, []);

  const handleLoginSuccess = (session: AuthSession) => {
    saveAuthSession(session);
    if (session.userRole === 'superadmin') {
      window.location.href = buildAdminUrl(undefined, 'superadmin');
    } else if (session.tenantId) {
      window.location.href = buildAdminUrl(session.tenantId);
    } else {
      window.location.href = buildAdminUrl();
    }
  };

  const handleOpenOrderPortal = () => {
    window.location.href = buildPortalUrl();
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
