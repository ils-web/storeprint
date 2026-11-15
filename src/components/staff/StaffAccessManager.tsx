import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserX,
  UserCheck,
  Search,
  KeyRound,
  Trash2,
  Edit3,
  Lock,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  RefreshCw,
} from 'lucide-react';
import { MultiTenantOrder, StaffDirectory, StaffMember, StaffSecurityPolicy } from '../../types/multiTenant';
import {
  DEFAULT_STAFF_SECURITY_POLICY,
  deleteStaffMember,
  extractKnownRequestersFromOrders,
  fetchStaffDirectory,
  getLocalStaffDirectory,
  normalizeStaffName,
  quickBlockByName,
  subscribeToStaffDirectory,
  toggleBlockStaffMember,
  updateStaffSecurityPolicy,
  upsertStaffMember,
} from '../../services/staffAccessService';
import { fetchOrdersFromFirestore } from '../../services/firestoreSync';

interface StaffAccessManagerProps {
  tenantId: string;
  tenantName: string;
  departments: string[];
  recentOrders?: MultiTenantOrder[];
  actorName?: string;
  onClose?: () => void;
}

export const StaffAccessManager: React.FC<StaffAccessManagerProps> = ({
  tenantId,
  tenantName,
  departments,
  recentOrders = [],
  actorName = 'מנהל סניף',
  onClose,
}) => {
  const [directory, setDirectory] = useState<StaffDirectory>(() => getLocalStaffDirectory(tenantId));
  const [cloudOrders, setCloudOrders] = useState<MultiTenantOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'active'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit modal form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [aliasesInput, setAliasesInput] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [departmentName, setDepartmentName] = useState('הכל');
  const [pinInput, setPinInput] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [memberStatus, setMemberStatus] = useState<'active' | 'blocked'>('active');
  const [blockedReason, setBlockedReason] = useState('');

  // Quick block confirmation prompt inline
  const [blockingTarget, setBlockingTarget] = useState<{
    mode: 'member' | 'quick';
    memberId?: string;
    fullName: string;
    departmentName?: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchStaffDirectory(tenantId).then((dir) => {
      if (active) setDirectory(dir);
    });
    fetchOrdersFromFirestore(tenantId)
      .then((orders) => {
        if (active && Array.isArray(orders)) setCloudOrders(orders);
      })
      .catch(() => {});
    const unsub = subscribeToStaffDirectory(tenantId, (dir) => {
      if (active) setDirectory(dir);
    });
    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [tenantId]);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const resetForm = () => {
    setEditingMemberId(null);
    setFullName('');
    setAliasesInput('');
    setRoleTitle('');
    setDepartmentName('הכל');
    setPinInput('');
    setClearPin(false);
    setMemberStatus('active');
    setBlockedReason('');
  };

  const openAddForm = (presetStatus: 'active' | 'blocked' = 'active') => {
    resetForm();
    setMemberStatus(presetStatus);
    if (presetStatus === 'blocked') {
      setBlockedReason('עובד שסיים העסקה / חסימת גישה');
    }
    setIsFormOpen(true);
  };

  const openEditForm = (member: StaffMember) => {
    setEditingMemberId(member.id);
    setFullName(member.fullName);
    setAliasesInput((member.aliases || []).join(', '));
    setRoleTitle(member.roleTitle || '');
    setDepartmentName(member.departmentName || 'הכל');
    setPinInput('');
    setClearPin(false);
    setMemberStatus(member.status);
    setBlockedReason(member.blockedReason || '');
    setIsFormOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showBanner('error', 'נא להזין שם מלא של העובד/ת');
      return;
    }

    setIsSaving(true);
    try {
      const aliases = aliasesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await upsertStaffMember(tenantId, {
        id: editingMemberId || undefined,
        fullName: fullName.trim(),
        aliases,
        roleTitle: roleTitle.trim(),
        departmentName: departmentName === 'הכל' ? '' : departmentName,
        plainPin: pinInput.trim() || undefined,
        clearPin,
        status: memberStatus,
        blockedReason: memberStatus === 'blocked' ? blockedReason.trim() || 'נחסם על ידי הנהלת הסניף' : undefined,
        actorName,
      });
      setDirectory(updated);
      setIsFormOpen(false);
      resetForm();
      showBanner(
        'success',
        memberStatus === 'blocked'
          ? `העובד/ת "${fullName.trim()}" נשמר/ה כחסום מהזמנות וההרשאה עודכנה בענן.`
          : `פרטי העובד/ת "${fullName.trim()}" נשמרו וסונכרנו לענן.`
      );
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'שגיאה בשמירת פרטי העובד');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePolicy = async (key: keyof StaffSecurityPolicy) => {
    const nextValue = !directory.policy[key];
    setIsSaving(true);
    try {
      const updated = await updateStaffSecurityPolicy(tenantId, { [key]: nextValue });
      setDirectory(updated);
      showBanner('success', 'מדיניות האבטחה של הסניף עודכנה ונכנסה לתוקף מיידי בכל המכשירים.');
    } catch {
      showBanner('error', 'שגיאה בעדכון מדיניות האבטחה בענן');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockingTarget) return;
    setIsSaving(true);
    try {
      let updated: StaffDirectory;
      if (blockingTarget.mode === 'member' && blockingTarget.memberId) {
        updated = await toggleBlockStaffMember(
          tenantId,
          blockingTarget.memberId,
          true,
          blockingTarget.reason,
          actorName
        );
      } else {
        updated = await quickBlockByName(
          tenantId,
          blockingTarget.fullName,
          blockingTarget.departmentName,
          blockingTarget.reason,
          actorName
        );
      }
      setDirectory(updated);
      showBanner('success', `הגישה להזמנות עבור "${blockingTarget.fullName}" נחסמה מידית.`);
      setBlockingTarget(null);
    } catch {
      showBanner('error', 'שגיאה בחסימת העובד');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblockMember = async (member: StaffMember) => {
    setIsSaving(true);
    try {
      const updated = await toggleBlockStaffMember(tenantId, member.id, false, undefined, actorName);
      setDirectory(updated);
      showBanner('success', `החסימה הוסרה: "${member.fullName}" יכול/ה לחזור להזמין.`);
    } catch {
      showBanner('error', 'שגיאה בביטול החסימה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async (member: StaffMember) => {
    if (!window.confirm(`למחוק את "${member.fullName}" מרשימת הצוות?\nלתשומת לבך: עובד חסום שמסומן כאן נמחק מהחסימה אם תסיר אותו.`)) {
      return;
    }
    setIsSaving(true);
    try {
      const updated = await deleteStaffMember(tenantId, member.id);
      setDirectory(updated);
      showBanner('success', `"${member.fullName}" הוסר מהרשימה.`);
    } catch {
      showBanner('error', 'שגיאה במחיקה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveKnownRequester = async (name: string, dept: string) => {
    setIsSaving(true);
    try {
      const updated = await upsertStaffMember(tenantId, {
        fullName: name,
        departmentName: dept,
        status: 'active',
        actorName,
      });
      setDirectory(updated);
      showBanner('success', `"${name}" נוסף כעובד/ת פעיל/ה ומאושר/ת להזמנות.`);
    } catch {
      showBanner('error', 'שגיאה בהוספת העובד');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportAllRecentAsActive = async () => {
    if (knownRequesters.length === 0) return;
    if (!window.confirm(`לייבא ${knownRequesters.length} מזמינים מהזמנות אחרונות כעובדים פעילים?`)) return;
    setIsSaving(true);
    try {
      let current = directory;
      for (const req of knownRequesters) {
        current = await upsertStaffMember(tenantId, {
          fullName: req.name,
          departmentName: req.lastDepartment,
          status: 'active',
          actorName,
        });
      }
      setDirectory(current);
      showBanner('success', `יובאו ${knownRequesters.length} עובדים בהצלחה לרשימת המזמינים הפעילים.`);
    } catch {
      showBanner('error', 'שגיאה בייבוא רשימת המזמינים');
    } finally {
      setIsSaving(false);
    }
  };

  const policy = directory.policy || DEFAULT_STAFF_SECURITY_POLICY;
  const activeCount = directory.members.filter((m) => m.status === 'active').length;
  const blockedCount = directory.members.filter((m) => m.status === 'blocked').length;
  const pinCount = directory.members.filter((m) => Boolean(m.pinHash)).length;

  const mergedRecentOrders = useMemo(() => {
    const map = new Map<string, MultiTenantOrder>();
    cloudOrders.forEach((o) => {
      if (o?.id) map.set(o.id, o);
    });
    recentOrders.forEach((o) => {
      if (!o?.id) return;
      const prev = map.get(o.id);
      map.set(o.id, {
        ...prev,
        ...o,
        requesterName: o.requesterName || prev?.requesterName,
        notes: o.notes || prev?.notes,
      });
    });
    return Array.from(map.values());
  }, [recentOrders, cloudOrders]);

  const knownRequesters = useMemo(
    () => extractKnownRequestersFromOrders(mergedRecentOrders, directory.members),
    [mergedRecentOrders, directory.members]
  );

  const filteredMembers = useMemo(() => {
    const q = normalizeStaffName(searchQuery);
    return directory.members.filter((m) => {
      if (statusFilter === 'blocked' && m.status !== 'blocked') return false;
      if (statusFilter === 'active' && m.status !== 'active') return false;
      if (!q) return true;
      const hay = [
        m.fullName,
        ...(m.aliases || []),
        m.departmentName || '',
        m.roleTitle || '',
        m.blockedReason || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [directory.members, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 text-slate-900" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">
                  בקרת גישה, עובדים והגנת הזמנות — {tenantName}
                </h2>
                {isSaving && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    מסנכרן לענן...
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                חסימת עובדים שפוטרו מלבצע הזמנות באפליקציה (PWA), רשימת מורשים (Allowlist) ואימות קוד PIN אישי בזמן אמת.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => openAddForm('blocked')}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all"
            >
              <UserX className="w-4 h-4" />
              חסום עובד לפי שם
            </button>
            <button
              type="button"
              onClick={() => openAddForm('active')}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              הוסף עובד מורשה
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500"
                title="סגור"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-700">עובדים פעילים</div>
              <div className="text-2xl font-black text-emerald-900">{activeCount}</div>
            </div>
            <UserCheck className="w-7 h-7 text-emerald-500/70" />
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-rose-700">חסומים מלהזמין</div>
              <div className="text-2xl font-black text-rose-900">{blockedCount}</div>
            </div>
            <UserX className="w-7 h-7 text-rose-500/70" />
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-indigo-700">מוגני PIN אישי</div>
              <div className="text-2xl font-black text-indigo-900">{pinCount}</div>
            </div>
            <KeyRound className="w-7 h-7 text-indigo-500/70" />
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-bold ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Security Policies */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-black text-base">
          <Lock className="w-5 h-5 text-indigo-600" />
          <span>מדיניות אבטחה ומניעת עקיפת חסימה</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 cursor-pointer bg-slate-50/70">
            <div>
              <div className="font-bold text-slate-800 text-sm">רשימת עובדים מורשים בלבד (Allowlist)</div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                כשמופעל, רק עובדים שמופיעים כאן כ&quot;פעילים&quot; רשאים להזמין. מונע מעובד שפוטר להקליד שם מזויף או שגיאת כתיב.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.requireRegisteredStaff}
              onChange={() => handleTogglePolicy('requireRegisteredStaff')}
              className="w-5 h-5 accent-indigo-600 mt-0.5 shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 cursor-pointer bg-slate-50/70">
            <div>
              <div className="font-bold text-slate-800 text-sm">חייב קוד PIN אישי לכל הזמנה</div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                כשמופעל, כל מזמין נדרש להקיש קוד PIN אישי סודי. מונע התחזות לשם של עובד פעיל אחר.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.requirePersonalPin}
              onChange={() => handleTogglePolicy('requirePersonalPin')}
              className="w-5 h-5 accent-indigo-600 mt-0.5 shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 cursor-pointer bg-slate-50/70">
            <div>
              <div className="font-bold text-slate-800 text-sm">נעילת ממשק המחסן בהתחברות מנהל</div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                כשמופעל, כניסה למערכת המחסן (<span dir="ltr">index.html / stock.html</span>) בסניף זה דורשת סיסמת מנהל פעילה.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.requireAdminLoginForWorkspace}
              onChange={() => handleTogglePolicy('requireAdminLoginForWorkspace')}
              className="w-5 h-5 accent-indigo-600 mt-0.5 shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-slate-200 hover:border-rose-300 cursor-pointer bg-slate-50/70">
            <div>
              <div className="font-bold text-slate-800 text-sm">אפשר מחיקת הזמנות מהיסטוריית המובייל</div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                מומלץ להשאיר <strong>כבוי</strong>! מונע מעובד מחלקה למחוק הזמנות שכבר נשלחו לענן מהמכשיר שלו.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.allowPortalOrderDelete}
              onChange={() => handleTogglePolicy('allowPortalOrderDelete')}
              className="w-5 h-5 accent-rose-600 mt-0.5 shrink-0"
            />
          </label>
        </div>

        {!policy.requireRegisteredStaff && blockedCount > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>טיפ לאבטחה מקסימלית:</strong> יש לך {blockedCount} עובד/ים חסומים, אך מצב &quot;רשימת עובדים מורשים בלבד&quot; כבוי.
              מומלץ לייבא תחילה את העובדים הפעילים מהזמנות אחרונות ואז להפעיל את מתג הרשימה המאושרת כדי שעובד מפוטר לא יוכל לעקוף את החסימה עם שם אחר.
            </div>
          </div>
        )}
      </div>

      {/* Inline Block Confirmation Dialog */}
      {blockingTarget && (
        <form
          onSubmit={handleConfirmBlock}
          className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 space-y-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-black">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>חסימת עובד מהזמנות: {blockingTarget.fullName}</span>
            </div>
            <button
              type="button"
              onClick={() => setBlockingTarget(null)}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              name="staff_block_reason"
              autoComplete="off"
              value={blockingTarget.reason}
              onChange={(e) => setBlockingTarget({ ...blockingTarget, reason: e.target.value })}
              placeholder="סיבת החסימה (אופציונלי, למשל: סיום העסקה)"
              className="flex-1 bg-white text-slate-900 placeholder:text-slate-400 border border-rose-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-sm shrink-0"
            >
              אשר חסימה מיידית
            </button>
          </div>
        </form>
      )}

      {/* Recent Requesters Discovered from Orders */}
      {knownRequesters.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-slate-800 text-sm sm:text-base">
              <History className="w-5 h-5 text-indigo-500" />
              <span>מזמינים שהתגלו מהזמנות אחרונות ({knownRequesters.length})</span>
            </div>
            <button
              type="button"
              onClick={handleImportAllRecentAsActive}
              disabled={isSaving}
              className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              אשר את כולם כעובדים פעילים
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {knownRequesters.map((req) => (
              <div
                key={req.normalizedName}
                className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{req.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {req.lastDepartment || 'ללא מחלקה'} • {req.ordersCount} הזמנות
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApproveKnownRequester(req.name, req.lastDepartment)}
                    disabled={isSaving}
                    title="הוסף כפעיל"
                    className="p-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBlockingTarget({
                        mode: 'quick',
                        fullName: req.name,
                        departmentName: req.lastDepartment,
                        reason: 'סיום העסקה / הרשאה בוטלה',
                      })
                    }
                    disabled={isSaving}
                    title="חסום עובד מהזמנות"
                    className="p-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Directory Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="staff_directory_search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש לפי שם עובד, מחלקה, תפקיד או כינוי..."
              className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            {([
              { id: 'all', label: `הכל (${directory.members.length})` },
              { id: 'blocked', label: `חסומים (${blockedCount})` },
              { id: 'active', label: `פעילים (${activeCount})` },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-sm">
            לא נמצאו עובדים תואמים. לחץ על &quot;חסום עובד לפי שם&quot; או &quot;הוסף עובד מורשה&quot; כדי להתחיל.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredMembers.map((member) => {
              const isBlocked = member.status === 'blocked';
              return (
                <div
                  key={member.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                    isBlocked
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-base">{member.fullName}</span>
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                          isBlocked
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isBlocked ? 'חסום מהזמנות' : 'פעיל'}
                      </span>
                      {member.pinHash && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                          <KeyRound className="w-3 h-3" />
                          מוגן PIN
                        </span>
                      )}
                      {member.departmentName && (
                        <span className="text-[11px] font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
                          מחלקה: {member.departmentName}
                        </span>
                      )}
                      {member.roleTitle && (
                        <span className="text-[11px] font-medium text-slate-500">{member.roleTitle}</span>
                      )}
                    </div>

                    {member.aliases && member.aliases.length > 0 && (
                      <div className="text-xs text-slate-500">
                        שמות חלופיים לחסימה/זיהוי: {member.aliases.join(', ')}
                      </div>
                    )}

                    {isBlocked && (
                      <div className="text-xs font-medium text-rose-700">
                        סיבה: {member.blockedReason || 'נחסם ע״י מנהל'}
                        {member.blockedAt && ` • נחסם בתאריך ${new Date(member.blockedAt).toLocaleDateString('he-IL')}`}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {isBlocked ? (
                      <button
                        type="button"
                        onClick={() => handleUnblockMember(member)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        בטל חסימה
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setBlockingTarget({
                            mode: 'member',
                            memberId: member.id,
                            fullName: member.fullName,
                            reason: 'סיום העסקה / שלילת הרשאה',
                          })
                        }
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        חסום עובד
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditForm(member)}
                      disabled={isSaving}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                      title="ערוך פרטים / PIN"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMember(member)}
                      disabled={isSaving}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                      title="הסר מהרשימה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Staff Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="font-black text-base flex items-center gap-2">
                {memberStatus === 'blocked' ? <UserX className="w-5 h-5 text-rose-400" /> : <UserPlus className="w-5 h-5 text-emerald-400" />}
                <span>{editingMemberId ? 'עריכת פרטי עובד והרשאה' : 'הוספת / חסימת עובד'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} autoComplete="off" className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">שם מלא של העובד/ת *</label>
                <input
                  type="text"
                  name="staff_member_full_name"
                  autoComplete="off"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="לדוגמה: דוד לוי"
                  className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  שמות חלופיים / כתיב נוסף (מופרד בפסיקים - לחסימה בטוחה)
                </label>
                <input
                  type="text"
                  name="staff_member_aliases"
                  autoComplete="off"
                  value={aliasesInput}
                  onChange={(e) => setAliasesInput(e.target.value)}
                  placeholder="למשל: דוד ל., David Levy, ד. לוי"
                  className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">הגבלה למחלקה (אופציונלי)</label>
                  <select
                    name="staff_member_department"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="הכל">כל מחלקות הסניף</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">תפקיד / מחלקה</label>
                  <input
                    type="text"
                    name="staff_member_role_title"
                    autoComplete="off"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="למשל: אחות מוסמכת"
                    className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">סטטוס גישה לאפליקציה</label>
                  <select
                    name="staff_member_status"
                    value={memberStatus}
                    onChange={(e) => setMemberStatus(e.target.value as 'active' | 'blocked')}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold outline-none ${
                      memberStatus === 'blocked'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    }`}
                  >
                    <option value="active">פעיל - מורשה להזמין</option>
                    <option value="blocked">חסום - אין גישה להזמין</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">קוד PIN אישי (אופציונלי)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      name="staff_member_pin_code"
                      autoComplete="off"
                      spellCheck={false}
                      dir="ltr"
                      inputMode="numeric"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        setClearPin(false);
                      }}
                      placeholder={editingMemberId ? 'השאר ריק לשמירת קיים' : '4-6 ספרות'}
                      className="flex-1 bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPinInput(String(Math.floor(1000 + Math.random() * 9000)));
                        setClearPin(false);
                      }}
                      className="px-2.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 shrink-0"
                    >
                      הגרל
                    </button>
                  </div>
                  {editingMemberId && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearPin}
                        onChange={(e) => {
                          setClearPin(e.target.checked);
                          if (e.target.checked) setPinInput('');
                        }}
                      />
                      <span>הסר קוד PIN אישי קיים</span>
                    </label>
                  )}
                </div>
              </div>

              {memberStatus === 'blocked' && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">סיבת חסימה</label>
                  <input
                    type="text"
                    name="staff_member_blocked_reason"
                    autoComplete="off"
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    placeholder="למשל: סיום העסקה / אין הרשאת ניפוק"
                    className="w-full bg-rose-50 text-rose-950 placeholder:text-rose-400 border border-rose-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-5 py-2.5 rounded-xl text-white text-sm font-black shadow-sm ${
                    memberStatus === 'blocked'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editingMemberId ? 'שמור שינויים' : memberStatus === 'blocked' ? 'שמור וחסום עובד' : 'שמור עובד'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
