import React, { useState } from 'react';
import {
  Tenant,
  Warehouse,
  PlanType,
  TenantStatus,
  AuthSession,
} from '../../types/multiTenant';
import {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  BILLING_PLANS,
  saveAuthSession,
} from '../../services/multiTenantDb';
import {
  Building2,
  Plus,
  Search,
  ShieldCheck,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Key,
  ExternalLink,
  Edit2,
  Trash2,
  Zap,
  Package,
  LogOut,
  ArrowRight,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  currentSession: AuthSession;
  onLogout: () => void;
  onSelectTenantApp: (tenantId: string) => void;
}

export function SuperAdminDashboard({
  currentSession,
  onLogout,
  onSelectTenantApp,
}: SuperAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tenants' | 'billing' | 'warehouses'>('tenants');
  const [tenantsList, setTenantsList] = useState<Tenant[]>(() => getTenants());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Form State for New Tenant
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
    plan: 'pro' as PlanType,
    contactPerson: '',
    phone: '',
    address: '',
    spreadsheetId: '',
    spreadsheetGid: '',
    allowSelfWarehouseCreation: false,
  });

  // Edit Tenant Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    login: '',
    password: '',
    plan: 'pro' as PlanType,
    status: 'active' as TenantStatus,
    contactPerson: '',
    phone: '',
    address: '',
    allowSelfWarehouseCreation: false,
  });

  // New Warehouse Form for Tenant
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseCode, setNewWarehouseCode] = useState('');
  const [newWarehouseAddress, setNewWarehouseAddress] = useState('');

  const refreshTenants = () => {
    setTenantsList(getTenants());
  };

  const filteredTenants = tenantsList.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalTenants = tenantsList.length;
  const activeTenants = tenantsList.filter((t) => t.status === 'active').length;
  const trialTenants = tenantsList.filter((t) => t.status === 'trial').length;
  const allWarehouses = getWarehouses();
  const estimatedMonthlyRevenueNis = tenantsList.reduce((acc, t) => {
    return acc + (BILLING_PLANS[t.plan]?.priceMonthlyNis || 0);
  }, 0);

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.login.trim() || !formData.password.trim()) {
      alert('נא למלא שם סניף, שם משתמש וסיסמה.');
      return;
    }

    try {
      createTenant(formData);
      refreshTenants();
      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        login: '',
        password: '',
        plan: 'pro',
        contactPerson: '',
        phone: '',
        address: '',
        spreadsheetId: '',
        spreadsheetGid: '',
        allowSelfWarehouseCreation: false,
      });
    } catch (err: any) {
      alert(err.message || 'שגיאה ביצירת סניף');
    }
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditFormData({
      name: tenant.name,
      login: tenant.login,
      password: tenant.passwordHash,
      plan: tenant.plan,
      status: tenant.status,
      contactPerson: tenant.contactPerson || '',
      phone: tenant.phone || '',
      address: tenant.address || '',
      allowSelfWarehouseCreation: tenant.limits.allowSelfWarehouseCreation,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    updateTenant(selectedTenant.id, {
      name: editFormData.name,
      login: editFormData.login,
      passwordHash: editFormData.password,
      plan: editFormData.plan,
      status: editFormData.status,
      contactPerson: editFormData.contactPerson,
      phone: editFormData.phone,
      address: editFormData.address,
      limits: {
        ...selectedTenant.limits,
        allowSelfWarehouseCreation: editFormData.allowSelfWarehouseCreation,
      },
    });

    refreshTenants();
    setIsEditModalOpen(false);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את הסניף "${tenant.name}"? פעולה זו היא בלתי הפיכה.`)) {
      deleteTenant(tenant.id);
      refreshTenants();
    }
  };

  const handleOpenWarehouses = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewWarehouseName('');
    setNewWarehouseCode('');
    setNewWarehouseAddress('');
    setIsWarehouseModalOpen(true);
  };

  const handleAddWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !newWarehouseName.trim()) return;

    createWarehouse({
      tenantId: selectedTenant.id,
      name: newWarehouseName.trim(),
      code: newWarehouseCode.trim() || undefined,
      address: newWarehouseAddress.trim() || undefined,
      isPrimary: false,
    });

    setNewWarehouseName('');
    setNewWarehouseCode('');
    setNewWarehouseAddress('');
    refreshTenants();
  };

  const handleImpersonate = (tenant: Tenant) => {
    saveAuthSession({
      userRole: 'tenant_admin',
      tenantId: tenant.id,
      tenantName: tenant.name,
      username: `${tenant.name} (SuperAdmin)`,
    });
    onSelectTenantApp(tenant.id);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">StorePrint Core</h1>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30">
                  סופר-אדמין
                </span>
              </div>
              <p className="text-xs text-slate-400">פאנל ניהול מרכזי לרשת סניפים ומחסנים</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('tenants')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'tenants'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>סניפים ({totalTenants})</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('billing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'billing'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>מסלולים וחיוב</span>
                </div>
              </button>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/30 cursor-pointer"
              title="התנתק מהמערכת"
            >
              <LogOut className="w-4 h-4" />
              <span>יציאה</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">סה״כ סניפים</span>
              <Building2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">{totalTenants}</div>
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{activeTenants} פעילים • {trialTenants} בתקופת ניסיון</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">מחסנים ברשת</span>
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">{allWarehouses.length}</div>
            <div className="mt-2 text-xs text-slate-400">
              ניהול ובקרה מרכזית
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">הכנסה חודשית משוערת</span>
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">₪{estimatedMonthlyRevenueNis}</div>
            <div className="mt-2 text-xs text-indigo-300">
              מוכן לחיבור סליקה ישראלית / Stripe
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">פעולה מהירה</span>
              <h3 className="text-base font-bold text-white mt-1">הוסף סניף חדש לרשת</h3>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-3 w-full py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>יצירת סניף חדש</span>
            </button>
          </div>
        </div>

        {/* TAB 1: TENANTS LIST */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="חיפוש לפי שם סניף או שם משתמש..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="active">פעילים</option>
                  <option value="trial">בתקופת ניסיון</option>
                  <option value="suspended">מושעים</option>
                </select>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>סניף חדש</span>
                </button>
              </div>
            </div>

            {/* Tenants Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTenants.map((tenant) => {
                const tenantWarehouses = getWarehouses(tenant.id);
                const planDetails = BILLING_PLANS[tenant.plan];

                return (
                  <div
                    key={tenant.id}
                    className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 shadow-xl hover:border-slate-600 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">
                            {tenant.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">קוד זיהוי: {tenant.slug}</p>
                        </div>

                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            tenant.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : tenant.status === 'trial'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {tenant.status === 'active'
                            ? 'פעיל'
                            : tenant.status === 'trial'
                            ? 'ניסיון'
                            : 'מושעה'}
                        </span>
                      </div>

                      {/* Credentials & Plan Info */}
                      <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-indigo-400" />
                            שם משתמש לכניסה:
                          </span>
                          <span className="font-mono text-indigo-300 font-bold bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
                            {tenant.login}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            סיסמה:
                          </span>
                          <span className="font-mono text-slate-300">
                            {tenant.passwordHash}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                            מסלול:
                          </span>
                          <span className="font-semibold text-purple-300">
                            {planDetails?.name || tenant.plan} (₪{planDetails?.priceMonthlyNis || 0}/חודש)
                          </span>
                        </div>
                      </div>

                      {/* Warehouses Summary */}
                      <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">מחסני הסניף:</span>
                          <span className="font-medium text-white">{tenantWarehouses.length} מחסן(ים)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">הקמת מחסנים ע״י הסניף:</span>
                          <span className={tenant.limits.allowSelfWarehouseCreation ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                            {tenant.limits.allowSelfWarehouseCreation ? 'מאושר' : 'מרכזי (סופר-אדמין)'}
                          </span>
                        </div>
                        {tenant.contactPerson && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">איש קשר:</span>
                            <span className="text-slate-200 truncate max-w-[160px]">{tenant.contactPerson}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleImpersonate(tenant)}
                        className="flex-1 py-2 px-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        title="כניסה למערכת הסניף"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>כניסה לסניף</span>
                      </button>

                      <button
                        onClick={() => handleOpenWarehouses(tenant)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="ניהול מחסני הסניף"
                      >
                        <Package className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(tenant)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="עריכת פרטים וסיסמה"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTenant(tenant)}
                        className="p-2 bg-slate-700/50 hover:bg-rose-600/80 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                        title="מחיקת סניף"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTenants.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-base font-medium">לא נמצאו סניפים</p>
                  <p className="text-xs text-slate-500 mt-1">נסה לשנות את מונח החיפוש או צור סניף חדש</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BILLING & PAYMENT GATEWAY HUB */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/30 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-bold text-white">מודול מנויים וסליקה מקוונת</h2>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">
                    המערכת מוכנה לחיבור שערי סליקה ישראליים (משולם / טרמינל / קארדקום) ו-Stripe.
                  </p>
                </div>
                <div className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Webhook API Ready (₪ NIS)</span>
                </div>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {Object.values(BILLING_PLANS).map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-slate-800/80 border rounded-2xl p-5 flex flex-col justify-between relative shadow-xl ${
                    plan.id === 'pro'
                      ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-700/80'
                  }`}
                >
                  {plan.id === 'pro' && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-full shadow">
                      המומלץ ביותר
                    </span>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>

                    <div className="my-4">
                      <span className="text-3xl font-extrabold text-white">₪{plan.priceMonthlyNis}</span>
                      <span className="text-xs text-slate-400"> / חודש</span>
                    </div>

                    <div className="space-y-2 border-t border-slate-700/60 pt-4 text-xs text-slate-300">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
                    <span className="text-xs text-slate-400">
                      מגבלת מחסנים: <strong className="text-white">{plan.maxWarehouses}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: CREATE TENANT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-white">הקמת סניף חדש ברשת</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  שם הסניף / המרכז הרפואי *
                </label>
                <input
                  type="text"
                  required
                  placeholder="לדוגמה: מרכז רפואי אסותא - אגף דרום"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    שם משתמש לכניסה *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="assuta_wh"
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    סיסמה *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="סיסמת גישה"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    מסלול מנוי
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as PlanType })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="free">בסיסי (חינם)</option>
                    <option value="starter">התחלתי (₪99/חודש)</option>
                    <option value="pro">Pro (₪279/חודש)</option>
                    <option value="enterprise">Enterprise (₪699/חודש)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    איש קשר
                  </label>
                  <input
                    type="text"
                    placeholder="שם מנהל המחסן"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  כתובת / מבנה
                </label>
                <input
                  type="text"
                  placeholder="רחוב, עיר, קומה"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="selfWhCheck"
                  checked={formData.allowSelfWarehouseCreation}
                  onChange={(e) => setFormData({ ...formData, allowSelfWarehouseCreation: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="selfWhCheck" className="text-xs text-slate-300 cursor-pointer">
                  <strong className="text-white block">אפשר לסניף לפתוח מחסנים עצמאית</strong>
                  כאשר כבוי - רק סופר-אדמין יכול להוסיף מחסנים לסניף באופן מרכזי.
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  הקם סניף
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TENANT */}
      {isEditModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-bold text-lg text-white">עריכת פרטי סניף</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  שם הסניף
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    שם משתמש
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.login}
                    onChange={(e) => setEditFormData({ ...editFormData, login: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    סיסמה
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    סטטוס
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as TenantStatus })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm cursor-pointer"
                  >
                    <option value="active">פעיל</option>
                    <option value="trial">תקופת ניסיון</option>
                    <option value="suspended">מושעה</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    מסלול מנוי
                  </label>
                  <select
                    value={editFormData.plan}
                    onChange={(e) => setEditFormData({ ...editFormData, plan: e.target.value as PlanType })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm cursor-pointer"
                  >
                    <option value="free">בסיסי</option>
                    <option value="starter">התחלתי</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold cursor-pointer"
                >
                  שמירת שינויים
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE WAREHOUSES FOR TENANT */}
      {isWarehouseModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="font-bold text-lg text-white">מחסני הסניף</h3>
                <p className="text-xs text-indigo-400">{selectedTenant.name}</p>
              </div>
              <button
                onClick={() => setIsWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">מחסנים קיימים</h4>
                {getWarehouses(selectedTenant.id).map((wh) => (
                  <div
                    key={wh.id}
                    className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{wh.name}</span>
                        {wh.isPrimary && (
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase rounded-md border border-indigo-500/30">
                            ראשי
                          </span>
                        )}
                      </div>
                      {wh.address && <p className="text-xs text-slate-400 mt-0.5">{wh.address}</p>}
                    </div>
                    <span className="text-xs font-mono text-slate-400">{wh.code || wh.id}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddWarehouse} className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  הוספת מחסן חדש לסניף (מרכזי ע״י סופר-אדמין)
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="שם המחסן (לדוגמה: בית מרקחת / מחסן ב')"
                      value={newWarehouseName}
                      onChange={(e) => setNewWarehouseName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="קוד (WH-02)"
                      value={newWarehouseCode}
                      onChange={(e) => setNewWarehouseCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="כתובת / קומה"
                    value={newWarehouseAddress}
                    onChange={(e) => setNewWarehouseAddress(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap cursor-pointer"
                  >
                    + הוסף מחסן
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
