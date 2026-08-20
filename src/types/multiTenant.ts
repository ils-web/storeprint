export type PackagingUnit = 'pcs' | 'box' | 'pack' | 'carton' | 'roll' | 'bottle' | 'kg' | 'liter' | string;

export interface PackagingUnitOption {
  value: PackagingUnit;
  labelHe: string;
  labelRu: string;
  defaultRatio?: number;
}

export const STANDARD_PACKAGING_UNITS: PackagingUnitOption[] = [
  { value: "יח'", labelHe: "יחידה (יח')", labelRu: 'Штука (шт)', defaultRatio: 1 },
  { value: 'חבילה', labelHe: 'חבילה / מארז', labelRu: 'Пачка / Упаковка', defaultRatio: 10 },
  { value: 'קופסה', labelHe: 'קופסה / ארגז', labelRu: 'Коробка (кор)', defaultRatio: 24 },
  { value: 'קרטון', labelHe: 'קרטון (יצוא)', labelRu: 'Картон (ящик)', defaultRatio: 48 },
  { value: 'גליל', labelHe: 'גליל', labelRu: 'Рулон', defaultRatio: 1 },
  { value: 'בקבוק', labelHe: 'בקבוק / בקבוקון', labelRu: 'Флакон / Бутылка', defaultRatio: 1 },
  { value: 'מטר', labelHe: 'מטר (מ\')', labelRu: 'Метр', defaultRatio: 1 },
  { value: 'ק״ג', labelHe: 'קילוגרם (ק״ג)', labelRu: 'Килограмм (кг)', defaultRatio: 1 },
  { value: 'ליטר', labelHe: 'ליטר (ל\')', labelRu: 'Литр (л)', defaultRatio: 1 },
];

export type TenantStatus = 'active' | 'trial' | 'suspended';
export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';
export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled';

export interface TenantBilling {
  status: BillingStatus;
  planId: PlanType;
  trialEndsAt?: string;
  subscriptionRenewsAt?: string;
  monthlyPriceNis?: number; // Israeli New Shekels (₪)
  paymentProvider?: 'stripe' | 'isracard' | 'meshulam' | 'manual';
  paymentMethodLast4?: string;
}

export interface TenantLimits {
  maxWarehouses: number;
  maxDepartments: number;
  maxOrdersPerMonth: number;
  allowSelfWarehouseCreation: boolean;
}

export interface Tenant {
  id: string;
  name: string;             // e.g. "מרכז רפואי הדסה - סניף 1"
  slug: string;             // e.g. "hadassah-branch-1"
  login: string;            // email / username
  passwordHash: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  status: TenantStatus;
  plan: PlanType;
  billing: TenantBilling;
  limits: TenantLimits;
  spreadsheetId?: string;
  spreadsheetGid?: string;
  appsScriptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;             // "מחסן מרכזי", "מחסן מתכלים", "בית מרקחת"
  code?: string;
  isPrimary: boolean;
  address?: string;
  responsiblePerson?: string;
  createdAt: string;
}

export interface InventoryProduct {
  id: string;
  tenantId: string;
  warehouseId: string;
  name: string;
  colIndex?: number;
  currentStock: number;
  minThreshold: number;
  unit: string;             // "יח'", "חבילה", "קופסה", "קרטון", etc.
  unitRatio?: number;
  category?: string;
  barcode?: string;
  lastDeducted?: string;
  updatedAt: string;
}

export interface TenantDepartment {
  id: string;
  tenantId: string;
  name: string;             // e.g. "ג' 2 סיעוד מורכב"
  code?: string;
  pinCode?: string;
  contactEmail?: string;
}

export type OrderStatus = 'NEW' | 'IN_PROGRESS' | 'PRINTED' | 'ISSUED' | 'CANCELLED';
export type OrderSource = 'WEB_PORTAL' | 'GOOGLE_FORM' | 'MANUAL';

export interface MultiTenantOrderItem {
  id: string;
  productId: string;
  name: string;
  orderedQty: number;
  orderedUnit: string;
  numericQtyInPieces?: number;
  fulfilledQty?: number;
  checked?: boolean;
}

export interface MultiTenantOrder {
  id: string;
  tenantId: string;
  warehouseId: string;
  departmentId: string;
  departmentName: string;
  patientsCount?: string;
  orderNumber: string;
  items: MultiTenantOrderItem[];
  totalItemsCount: number;
  notes?: string;
  status: OrderStatus;
  source: OrderSource;
  printed: boolean;
  printedAt?: string;
  createdAt: string;
  rawGoogleSheetRow?: number;
}

export type UserRole = 'superadmin' | 'tenant_admin' | 'department_staff' | 'guest';

export interface AuthSession {
  userRole: UserRole;
  tenantId?: string;
  tenantName?: string;
  departmentId?: string;
  departmentName?: string;
  username: string;
  token?: string;
}
