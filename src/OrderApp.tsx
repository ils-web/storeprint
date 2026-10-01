import React, { useEffect, useState } from 'react';
import { StaffOrderPortal } from './components/portal/StaffOrderPortal';
import { PWAInstallBanner } from './components/PWAInstallBanner';

export default function OrderApp() {
  const [initialDept, setInitialDept] = useState<string | undefined>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('dept') || undefined;
      }
    } catch {}
    return undefined;
  });

  const [initialTenant, setInitialTenant] = useState<string | undefined>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('tenant') || undefined;
      }
    } catch {}
    return undefined;
  });

  const [initialWarehouse, setInitialWarehouse] = useState<string | undefined>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('wh') || urlParams.get('warehouse') || undefined;
      }
    } catch {}
    return undefined;
  });

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const deptParam = urlParams.get('dept');
      const tenantParam = urlParams.get('tenant');
      const whParam = urlParams.get('wh') || urlParams.get('warehouse');
      if (deptParam && deptParam !== initialDept) setInitialDept(deptParam);
      if (tenantParam && tenantParam !== initialTenant) setInitialTenant(tenantParam);
      if (whParam && whParam !== initialWarehouse) setInitialWarehouse(whParam);
    } catch {}
  }, [initialDept, initialTenant, initialWarehouse]);

  return (
    <div className="min-h-screen font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      <StaffOrderPortal
        key={`${initialTenant || 'default'}_${initialWarehouse || 'defaultWh'}`}
        initialTenantId={initialTenant}
        initialDepartment={initialDept}
        initialWarehouseId={initialWarehouse}
      />
      <PWAInstallBanner />
    </div>
  );
}
