import { doc, getDoc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db, ensureFirebaseAuth, isFirebaseReady } from './firebase';
import {
  MultiTenantOrder,
  StaffDirectory,
  StaffMember,
  StaffSecurityPolicy,
} from '../types/multiTenant';
import { hashSecret, verifySecret } from '../utils/crypto';

const STAFF_DIR_STORAGE_PREFIX = 'storeprint_staff_directory_v1_';

export const DEFAULT_STAFF_SECURITY_POLICY: StaffSecurityPolicy = {
  requireRegisteredStaff: false,
  requirePersonalPin: false,
  requireAdminLoginForWorkspace: false,
  allowPortalOrderDelete: false,
};

export interface KnownOrderRequester {
  name: string;
  normalizedName: string;
  lastDepartment: string;
  lastOrderAt: string;
  ordersCount: number;
}

export interface StaffAccessCheckResult {
  allowed: boolean;
  reason?: 'missing_name' | 'blocked' | 'not_registered' | 'department_mismatch' | 'missing_pin' | 'invalid_pin' | 'pin_not_configured';
  message?: string;
  matchedMember?: StaffMember;
  requiresPin?: boolean;
}

export function normalizeStaffName(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/["'׳״`]/g, '')
    .replace(/[-_.,/\\()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSortedNameKey(name: string): string {
  const norm = normalizeStaffName(name);
  if (!norm) return '';
  const tokens = norm.split(' ').filter(Boolean);
  if (tokens.length <= 1) return norm;
  return [...tokens].sort().join(' ');
}

function getStaffStorageKey(tenantId: string): string {
  return `${STAFF_DIR_STORAGE_PREFIX}${tenantId}`;
}

function normalizePolicy(raw?: Partial<StaffSecurityPolicy> | null): StaffSecurityPolicy {
  return {
    requireRegisteredStaff: Boolean(raw?.requireRegisteredStaff),
    requirePersonalPin: Boolean(raw?.requirePersonalPin),
    requireAdminLoginForWorkspace: Boolean(raw?.requireAdminLoginForWorkspace),
    allowPortalOrderDelete: Boolean(raw?.allowPortalOrderDelete),
  };
}

function sanitizeMemberForStorage(member: StaffMember): Record<string, unknown> {
  const clean: Record<string, unknown> = {
    id: member.id,
    tenantId: member.tenantId,
    fullName: member.fullName.trim(),
    normalizedName: normalizeStaffName(member.fullName),
    status: member.status === 'blocked' ? 'blocked' : 'active',
    createdAt: member.createdAt || new Date().toISOString(),
    updatedAt: member.updatedAt || new Date().toISOString(),
  };

  if (Array.isArray(member.aliases) && member.aliases.length > 0) {
    clean.aliases = member.aliases.map((a) => a.trim()).filter(Boolean);
  }
  if (member.departmentName && member.departmentName.trim()) {
    clean.departmentName = member.departmentName.trim();
  }
  if (member.roleTitle && member.roleTitle.trim()) {
    clean.roleTitle = member.roleTitle.trim();
  }
  if (member.employeeCode && member.employeeCode.trim()) {
    clean.employeeCode = member.employeeCode.trim();
  }
  if (member.pinHash && member.pinHash.trim()) {
    clean.pinHash = member.pinHash.trim();
  }
  if (member.blockedReason && member.blockedReason.trim()) {
    clean.blockedReason = member.blockedReason.trim();
  }
  if (member.blockedAt) {
    clean.blockedAt = member.blockedAt;
  }
  if (member.blockedBy && member.blockedBy.trim()) {
    clean.blockedBy = member.blockedBy.trim();
  }
  return clean;
}

function hydrateDirectory(tenantId: string, raw?: Partial<StaffDirectory> | null): StaffDirectory {
  const members: StaffMember[] = Array.isArray(raw?.members)
    ? raw!.members
        .filter((m): m is StaffMember => Boolean(m && typeof m.id === 'string' && typeof m.fullName === 'string'))
        .map((m) => ({
          ...m,
          tenantId: m.tenantId || tenantId,
          normalizedName: m.normalizedName || normalizeStaffName(m.fullName),
          status: m.status === 'blocked' ? 'blocked' : 'active',
        }))
    : [];

  return {
    tenantId,
    members,
    policy: normalizePolicy(raw?.policy),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

export function getLocalStaffDirectory(tenantId: string): StaffDirectory {
  const defaultDir = hydrateDirectory(tenantId, null);
  try {
    const raw = localStorage.getItem(getStaffStorageKey(tenantId));
    if (!raw) return defaultDir;
    const parsed = JSON.parse(raw) as Partial<StaffDirectory>;
    return hydrateDirectory(tenantId, parsed);
  } catch {
    return defaultDir;
  }
}

export function saveLocalStaffDirectory(directory: StaffDirectory): void {
  try {
    localStorage.setItem(getStaffStorageKey(directory.tenantId), JSON.stringify(directory));
  } catch (e) {
    console.error('Failed saving staff directory locally:', e);
  }
}

export async function saveStaffDirectory(directory: StaffDirectory): Promise<void> {
  const normalizedDir: StaffDirectory = {
    tenantId: directory.tenantId,
    members: directory.members,
    policy: normalizePolicy(directory.policy),
    updatedAt: new Date().toISOString(),
  };

  saveLocalStaffDirectory(normalizedDir);

  if (!isFirebaseReady || !db) return;
  try {
    await ensureFirebaseAuth();
    const docRef = doc(db, 'tenants', normalizedDir.tenantId, 'staff_access', 'directory');
    await setDoc(docRef, {
      tenantId: normalizedDir.tenantId,
      members: normalizedDir.members.map(sanitizeMemberForStorage),
      policy: normalizedDir.policy,
      updatedAt: normalizedDir.updatedAt,
    });
  } catch (e) {
    console.error('Failed syncing staff directory to Firestore:', e);
    throw e;
  }
}

export async function fetchStaffDirectory(tenantId: string): Promise<StaffDirectory> {
  const localDir = getLocalStaffDirectory(tenantId);
  if (!isFirebaseReady || !db) return localDir;

  try {
    await ensureFirebaseAuth();
    const docRef = doc(db, 'tenants', tenantId, 'staff_access', 'directory');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const hydrated = hydrateDirectory(tenantId, snap.data() as Partial<StaffDirectory>);
      saveLocalStaffDirectory(hydrated);
      return hydrated;
    }
  } catch (e) {
    console.warn('Failed fetching staff directory from Firestore:', e);
  }
  return localDir;
}

export function subscribeToStaffDirectory(
  tenantId: string,
  onUpdate: (directory: StaffDirectory) => void
): Unsubscribe | null {
  const initialLocal = getLocalStaffDirectory(tenantId);
  onUpdate(initialLocal);

  if (!isFirebaseReady || !db) return null;

  let cancelled = false;
  let unsubscribeFn: Unsubscribe | null = null;

  ensureFirebaseAuth().finally(() => {
    if (cancelled || !db) return;
    try {
      const docRef = doc(db, 'tenants', tenantId, 'staff_access', 'directory');
      unsubscribeFn = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const hydrated = hydrateDirectory(tenantId, snap.data() as Partial<StaffDirectory>);
            saveLocalStaffDirectory(hydrated);
            onUpdate(hydrated);
          } else {
            const fallbackLocal = getLocalStaffDirectory(tenantId);
            onUpdate(fallbackLocal);
          }
        },
        (err) => {
          console.warn('Staff directory subscription warning:', err);
        }
      );
    } catch (e) {
      console.warn('Could not subscribe to staff directory:', e);
    }
  });

  return () => {
    cancelled = true;
    if (unsubscribeFn) unsubscribeFn();
  };
}

export function matchStaffMember(
  directory: StaffDirectory,
  inputName: string,
  selectedStaffId?: string
): StaffMember | undefined {
  if (selectedStaffId) {
    const byId = directory.members.find((m) => m.id === selectedStaffId);
    if (byId) return byId;
  }

  const normInput = normalizeStaffName(inputName);
  if (!normInput) return undefined;
  const sortedInputKey = getSortedNameKey(normInput);

  // Prefer blocked entries if a conflict ever exists, otherwise first match
  const orderedMembers = [...directory.members].sort((a, b) => {
    if (a.status === 'blocked' && b.status !== 'blocked') return -1;
    if (a.status !== 'blocked' && b.status === 'blocked') return 1;
    return 0;
  });

  for (const member of orderedMembers) {
    const candidates = [member.fullName, ...(member.aliases || [])];
    for (const candidate of candidates) {
      const normCand = normalizeStaffName(candidate);
      if (!normCand) continue;
      if (normCand === normInput) return member;
      if (getSortedNameKey(normCand) === sortedInputKey && sortedInputKey.includes(' ')) {
        return member;
      }
    }
  }

  return undefined;
}

export async function checkRequesterOrderAccess(params: {
  directory: StaffDirectory;
  requesterName: string;
  departmentName?: string;
  pin?: string;
  selectedStaffId?: string;
}): Promise<StaffAccessCheckResult> {
  const { directory, requesterName, departmentName, pin, selectedStaffId } = params;
  const trimmedName = (requesterName || '').trim();

  // Always check name-based match FIRST so a blocked person cannot bypass by selecting an ID
  const nameMatched = trimmedName ? matchStaffMember(directory, trimmedName) : undefined;
  if (nameMatched && nameMatched.status === 'blocked') {
    return {
      allowed: false,
      reason: 'blocked',
      matchedMember: nameMatched,
      message: nameMatched.blockedReason
        ? `הגישה להזמנות עבור "${nameMatched.fullName}" נחסמה (${nameMatched.blockedReason}). יש לפנות למנהל המחסן.`
        : `הגישה להזמנות עבור "${nameMatched.fullName}" נחסמה על ידי הנהלת המחסן. במקרה של טעות יש לפנות למנהל הסניף.`,
    };
  }

  const matchedMember = matchStaffMember(directory, trimmedName, selectedStaffId);
  if (matchedMember && matchedMember.status === 'blocked') {
    return {
      allowed: false,
      reason: 'blocked',
      matchedMember,
      message: matchedMember.blockedReason
        ? `הגישה להזמנות עבור "${matchedMember.fullName}" נחסמה (${matchedMember.blockedReason}). יש לפנות למנהל המחסן.`
        : `הגישה להזמנות עבור "${matchedMember.fullName}" נחסמה על ידי הנהלת המחסן. במקרה של טעות יש לפנות למנהל הסניף.`,
    };
  }

  if (!trimmedName) {
    return {
      allowed: false,
      reason: 'missing_name',
      message: 'נא להזין שם מלא של המזמין/ה כדי לשלוח הזמנה.',
    };
  }

  if (directory.policy.requireRegisteredStaff && !matchedMember) {
    return {
      allowed: false,
      reason: 'not_registered',
      message: 'המחסן פועל במצב עובדים מאושרים בלבד. שמך לא נמצא ברשימת המזמינים המורשים בסניף זה.',
    };
  }

  if (
    matchedMember &&
    matchedMember.departmentName &&
    matchedMember.departmentName !== 'הכל' &&
    departmentName &&
    normalizeStaffName(matchedMember.departmentName) !== normalizeStaffName(departmentName)
  ) {
    return {
      allowed: false,
      reason: 'department_mismatch',
      matchedMember,
      message: `העובד "${matchedMember.fullName}" מורשה להזמין רק עבור מחלקה "${matchedMember.departmentName}".`,
    };
  }

  const pinIsRequired = Boolean(matchedMember?.pinHash || directory.policy.requirePersonalPin);
  if (pinIsRequired) {
    if (!matchedMember) {
      return {
        allowed: false,
        reason: 'not_registered',
        requiresPin: true,
        message: 'נדרש זיהוי עובד מאושר עם קוד PIN אישי כדי לשלוח הזמנה בסניף זה.',
      };
    }

    if (!matchedMember.pinHash) {
      return {
        allowed: false,
        reason: 'pin_not_configured',
        matchedMember,
        requiresPin: true,
        message: `לעובד "${matchedMember.fullName}" טרם הוגדר קוד PIN אישי. יש לבקש ממנהל המחסן להגדיר קוד.`,
      };
    }

    if (!pin || !pin.trim()) {
      return {
        allowed: false,
        reason: 'missing_pin',
        matchedMember,
        requiresPin: true,
        message: 'נא להזין את קוד ה-PIN האישי שלך לשליחת ההזמנה.',
      };
    }

    const pinResult = await verifySecret(pin.trim(), matchedMember.pinHash);
    if (!pinResult.matches) {
      return {
        allowed: false,
        reason: 'invalid_pin',
        matchedMember,
        requiresPin: true,
        message: 'קוד ה-PIN האישי שגוי. נא לבדוק ולנסות שוב.',
      };
    }
  }

  return {
    allowed: true,
    matchedMember,
    requiresPin: pinIsRequired,
  };
}

export async function upsertStaffMember(
  tenantId: string,
  input: {
    id?: string;
    fullName: string;
    aliases?: string[];
    departmentName?: string;
    roleTitle?: string;
    employeeCode?: string;
    plainPin?: string;
    clearPin?: boolean;
    status?: 'active' | 'blocked';
    blockedReason?: string;
    actorName?: string;
  }
): Promise<StaffDirectory> {
  const dir = await fetchStaffDirectory(tenantId);
  const now = new Date().toISOString();
  const trimmedName = input.fullName.trim();
  if (!trimmedName) throw new Error('שם העובד הוא שדה חובה');

  const existingIdx = input.id
    ? dir.members.findIndex((m) => m.id === input.id)
    : dir.members.findIndex((m) => normalizeStaffName(m.fullName) === normalizeStaffName(trimmedName));

  const existing = existingIdx >= 0 ? dir.members[existingIdx] : undefined;
  let pinHash = input.clearPin ? undefined : existing?.pinHash;
  if (input.plainPin && input.plainPin.trim()) {
    pinHash = await hashSecret(input.plainPin.trim());
  }

  const nextStatus = input.status ?? existing?.status ?? 'active';
  const nextMember: StaffMember = {
    id: existing?.id || `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    fullName: trimmedName,
    normalizedName: normalizeStaffName(trimmedName),
    aliases: input.aliases !== undefined
      ? input.aliases.map((a) => a.trim()).filter(Boolean)
      : existing?.aliases,
    departmentName: input.departmentName !== undefined
      ? input.departmentName.trim() || undefined
      : existing?.departmentName,
    roleTitle: input.roleTitle !== undefined ? input.roleTitle.trim() || undefined : existing?.roleTitle,
    employeeCode: input.employeeCode !== undefined ? input.employeeCode.trim() || undefined : existing?.employeeCode,
    pinHash,
    status: nextStatus,
    blockedReason:
      nextStatus === 'blocked'
        ? (input.blockedReason !== undefined ? input.blockedReason.trim() || undefined : existing?.blockedReason)
        : undefined,
    blockedAt: nextStatus === 'blocked' ? (existing?.status === 'blocked' ? existing.blockedAt : now) : undefined,
    blockedBy: nextStatus === 'blocked' ? (input.actorName || existing?.blockedBy || 'מנהל') : undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextMembers = [...dir.members];
  if (existingIdx >= 0) {
    nextMembers[existingIdx] = nextMember;
  } else {
    nextMembers.unshift(nextMember);
  }

  const updated: StaffDirectory = {
    ...dir,
    members: nextMembers,
    updatedAt: now,
  };
  await saveStaffDirectory(updated);
  return updated;
}

export async function toggleBlockStaffMember(
  tenantId: string,
  memberId: string,
  blocked: boolean,
  reason?: string,
  actorName?: string
): Promise<StaffDirectory> {
  const dir = await fetchStaffDirectory(tenantId);
  const now = new Date().toISOString();

  const nextMembers = dir.members.map((m) => {
    if (m.id !== memberId) return m;
    return {
      ...m,
      status: blocked ? ('blocked' as const) : ('active' as const),
      blockedReason: blocked ? reason?.trim() || 'נחסם על ידי מנהל הסניף' : undefined,
      blockedAt: blocked ? now : undefined,
      blockedBy: blocked ? actorName || 'מנהל' : undefined,
      updatedAt: now,
    };
  });

  const updated: StaffDirectory = {
    ...dir,
    members: nextMembers,
    updatedAt: now,
  };
  await saveStaffDirectory(updated);
  return updated;
}

export async function quickBlockByName(
  tenantId: string,
  fullName: string,
  departmentName?: string,
  reason?: string,
  actorName?: string
): Promise<StaffDirectory> {
  return upsertStaffMember(tenantId, {
    fullName,
    departmentName,
    status: 'blocked',
    blockedReason: reason || 'עובד לשעבר / הורשאה בוטלה',
    actorName,
  });
}

export async function deleteStaffMember(tenantId: string, memberId: string): Promise<StaffDirectory> {
  const dir = await fetchStaffDirectory(tenantId);
  const updated: StaffDirectory = {
    ...dir,
    members: dir.members.filter((m) => m.id !== memberId),
    updatedAt: new Date().toISOString(),
  };
  await saveStaffDirectory(updated);
  return updated;
}

export async function updateStaffSecurityPolicy(
  tenantId: string,
  policyPatch: Partial<StaffSecurityPolicy>
): Promise<StaffDirectory> {
  const dir = await fetchStaffDirectory(tenantId);
  const updated: StaffDirectory = {
    ...dir,
    policy: normalizePolicy({
      ...dir.policy,
      ...policyPatch,
    }),
    updatedAt: new Date().toISOString(),
  };
  await saveStaffDirectory(updated);
  return updated;
}

export function extractRequesterNameFromOrder(order: Pick<MultiTenantOrder, 'requesterName' | 'notes'>): string {
  if (order.requesterName && order.requesterName.trim()) {
    return order.requesterName.trim();
  }
  const notes = order.notes || '';
  const match = notes.match(/שם\s*מזמין(?:\/ה)?\s*[:\-]\s*([^|\n]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return '';
}

export function extractKnownRequestersFromOrders(
  orders: MultiTenantOrder[],
  existingMembers: StaffMember[]
): KnownOrderRequester[] {
  const existingKeys = new Set<string>();
  for (const member of existingMembers) {
    existingKeys.add(normalizeStaffName(member.fullName));
    for (const alias of member.aliases || []) {
      existingKeys.add(normalizeStaffName(alias));
    }
  }

  const map = new Map<string, KnownOrderRequester>();
  for (const order of orders) {
    const rawName = extractRequesterNameFromOrder(order);
    const norm = normalizeStaffName(rawName);
    if (!norm || existingKeys.has(norm)) continue;

    const current = map.get(norm);
    if (!current) {
      map.set(norm, {
        name: rawName,
        normalizedName: norm,
        lastDepartment: order.departmentName || '',
        lastOrderAt: order.createdAt || '',
        ordersCount: 1,
      });
    } else {
      current.ordersCount += 1;
      if ((order.createdAt || '') > current.lastOrderAt) {
        current.lastOrderAt = order.createdAt || '';
        current.lastDepartment = order.departmentName || current.lastDepartment;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}
