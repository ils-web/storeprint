import React, { useEffect, useState } from 'react';
import { StaffOrderPortal } from './components/portal/StaffOrderPortal';
import { PWAInstallBanner } from './components/PWAInstallBanner';

export default function OrderApp() {
  const [initialDept, setInitialDept] = useState<string | undefined>(undefined);
  const [initialTenant, setInitialTenant] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const deptParam = urlParams.get('dept');
      const tenantParam = urlParams.get('tenant');
      if (deptParam) setInitialDept(deptParam);
      if (tenantParam) setInitialTenant(tenantParam);
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      <StaffOrderPortal
        initialTenantId={initialTenant}
        initialDepartment={initialDept}
      />
      <PWAInstallBanner />
    </div>
  );
}
