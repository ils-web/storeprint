/**
 * Shared URL builders for multi-branch entrypoints (Admin, Staff Ordering PWA,
 * Mobile Stock Manager, SuperAdmin Landing) across root and GitHub Pages subpaths.
 */

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  let cleanPath = window.location.pathname || '';
  cleanPath = cleanPath.replace(/\/(index|order|stock|landing)\.html$/i, '');
  cleanPath = cleanPath.replace(/\/(order|stock)\/?$/i, '');
  cleanPath = cleanPath.replace(/\/+$/, '');
  return `${window.location.origin}${cleanPath}`;
}

export function buildPortalUrl(tenantId?: string, departmentName?: string, warehouseId?: string): string {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenant', tenantId);
  if (warehouseId) params.set('wh', warehouseId);
  if (departmentName) params.set('dept', departmentName);
  const query = params.toString();
  return `${getAppBaseUrl()}/order.html${query ? `?${query}` : ''}`;
}

export function buildStockUrl(tenantId?: string): string {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenant', tenantId);
  const query = params.toString();
  return `${getAppBaseUrl()}/stock.html${query ? `?${query}` : ''}`;
}

export function buildAdminUrl(tenantId?: string, view?: string): string {
  const params = new URLSearchParams();
  if (view) params.set('view', view);
  if (tenantId) params.set('tenant', tenantId);
  const query = params.toString();
  return `${getAppBaseUrl()}/index.html${query ? `?${query}` : ''}`;
}

export function buildLandingUrl(): string {
  return `${getAppBaseUrl()}/index.html`;
}

export function buildQrImageUrl(targetUrl: string, size: number = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}&margin=10`;
}
