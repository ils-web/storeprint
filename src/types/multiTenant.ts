export type PackagingUnit = 'pcs' | 'box' | 'pack' | 'carton' | 'roll' | 'bottle' | 'kg' | 'liter' | string;

export interface PackagingUnitOption {
  value: PackagingUnit;
  labelRu: string;
  labelHe: string;
  defaultRatio?: number; // e.g. 1 carton = 24 pcs
}

export const STANDARD_PACKAGING_UNITS: PackagingUnitOption[] = [
  { value: 'pcs', labelRu: 'Штука (шт)', labelHe: 'יח׳', defaultRatio: 1 },
  { value: 'pack', labelRu: 'Пачка / Упаковка', labelHe: 'חבילה / מארז', defaultRatio: 10 },
  { value: 'box', labelRu: 'Коробка (кор)', labelHe: 'קופסה / ארגז', defaultRatio: 24 },
  { value: 'carton', labelRu: 'Картон (ящик)', labelHe: 'קרטון', defaultRatio: 48 },
  { value: 'roll', labelRu: 'Рулон', labelHe: 'גליל', defaultRatio: 1 },
  { value: 'bottle', labelRu: 'Флакон / Бутылка', labelHe: 'בקבוק', defaultRatio: 1 },
  { value: 'kg', labelRu: 'Килограмм (кг)', labelHe: 'ק״ג', defaultRatio: 1 },
  { value: 'liter', labelRu: 'Литр (л)', labelHe: 'ליטר', defaultRatio: 1 },
];

export type TenantStatus = 'active' | 'trial' | 'suspended';
export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';
export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled';

export interface TenantBilling {
  status: BillingStatus;
  planId: PlanType;
  trialEndsAt?: string;
  subscriptionRenewsAt?: string;
  monthlyPriceUsd?: number;
  paymentProvider?: 'stripe' | 'paypal' | 'manual';
  paymentMethodLast4?: string;
  stripeCustomerId?: string;
}

export interface TenantLimits {
  maxWarehouses: number;
  maxDepartments: number;
  maxOrdersPerMonth: number;
  allowSelfWarehouseCreation: boolean; // Flag allowing tenant to create warehouses on their own
}

export interface Tenant {
  id: string;
  name: string;             // e.g. "Госпиталь Хадасса - Филиал №1"
  slug: string;             // e.g. "hadassah-branch-1"
  login: string;            // email / username
  passwordHash: string;     // hashed or plain for local demo
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
  name: string;             // "Центральный склад", "Расходный склад", "Аптека"
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
  unit: PackagingUnit;
  unitRatio?: number;       // conversion ratio to pieces
  category?: string;
  barcode?: string;
  lastDeducted?: string;
  updatedAt: string;
}

export interface TenantDepartment {
  id: string;
  tenantId: string;
  name: string;             // Department / Ward name e.g. "ג' 2 סיעוד מורכב"
  code?: string;
  pinCode?: string;
  contactEmail?: string;
  orderDays?: string[];     // Days of week allowed to order
}

export type OrderStatus = 'NEW' | 'IN_PROGRESS' | 'PRINTED' | 'ISSUED' | 'CANCELLED';
export type OrderSource = 'WEB_PORTAL' | 'GOOGLE_FORM' | 'MANUAL';

export interface MultiTenantOrderItem {
  id: string;
  productId: string;
  name: string;
  orderedQty: number;
  orderedUnit: PackagingUnit;
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
