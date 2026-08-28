import {
  Store,
  UserAccount,
  CogsMaster,
  StockAdjustment,
  ClosingPlanRecord,
  ThawingItem,
  FabricationSegment,
  DailyClosingReport,
  LossAlertConfig,
} from '../types';

// Default alert configuration
const DEFAULT_CONFIG: LossAlertConfig = {
  maxProcessLossPercent: 1.0,
  maxSalesLossPercent: 1.0,
  maxDailyLossPercent: 2.0,
  safeThawingLossPercent: 1.0,
  safeFabricationLossPercent: 1.0,
  salesPredictionKg: 40.0,
};

// Background sync helper to update backend database
const postApiBackground = async (endpoint: string, body: any) => {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn(`Sync to ${endpoint} notice:`, e);
  }
};

/**
 * Smart User / Store Resolver:
 * Resolves username input (e.g. 'md_pusat', 'butcher_ckt', 'admin_ckt', 'cikut')
 * directly to the UserAccount based on current stores and database users.
 */
export function resolveUserFromInput(usernameInput: string): UserAccount {
  const raw = usernameInput.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const cleanInput = usernameInput.trim().toLowerCase();

  // 1. MD Pusat
  if (
    cleanInput.includes('md') ||
    cleanInput.includes('merchandis') ||
    cleanInput.includes('pusat') ||
    raw === 'mdpusat' ||
    raw === 'md'
  ) {
    return {
      id: 'user_md_1',
      username: 'md_pusat',
      role: 'md',
      fullName: 'Chief Merchandiser (MD Pusat)',
      createdAt: new Date().toISOString(),
    };
  }

  // 2. Check existing user list by username
  const currentUsers = getUsers();
  const exactMatch = currentUsers.find(
    (u) => u.username.toLowerCase() === cleanInput || u.username.toLowerCase().replace(/[\s_-]+/g, '') === raw
  );
  if (exactMatch) {
    return exactMatch;
  }

  // 3. Determine role
  const isButcher = cleanInput.includes('butcher') || cleanInput.includes('jagal') || cleanInput.includes('potong');
  const role: 'butcher' | 'admin' = isButcher ? 'butcher' : 'admin';

  // 4. Match branch store
  const allStores = getStores();
  let matchedStore: Store | undefined;

  for (const store of allStores) {
    const code = store.code.toLowerCase();
    const city = store.city.toLowerCase().replace(/[\s_-]+/g, '');
    const nameClean = store.name.toLowerCase().replace(/[\s_-]+/g, '');

    if (cleanInput.includes(code) || raw.includes(code) || raw.includes(city) || raw.includes(nameClean)) {
      matchedStore = store;
      break;
    }
  }

  if (!matchedStore && allStores.length > 0) {
    matchedStore = allStores[0];
  }

  const codeLower = matchedStore?.code.toLowerCase() || 'ckt';
  const storeName = matchedStore?.name || 'TDN Cikut';
  const storeId = matchedStore?.id || 'store_ckt';

  return {
    id: `user_${role}_${codeLower}`,
    username: `${role}_${codeLower}`,
    role,
    storeId,
    storeName,
    fullName: `${role === 'butcher' ? 'Butcher' : 'Admin'} ${storeName}`,
    createdAt: new Date().toISOString(),
  };
}

// --- DATABASE SYNCHRONIZATION HELPERS (POSTGRESQL via API) ---

export const getStores = (): Store[] => {
  const data = localStorage.getItem('stores_list');
  return data ? JSON.parse(data) : [];
};

export const saveStores = (stores: Store[]) => {
  localStorage.setItem('stores_list', JSON.stringify(stores));
};

export const getUsers = (): UserAccount[] => {
  const data = localStorage.getItem('users_list');
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem('users_list', JSON.stringify(users));
};

export const getCurrentUser = (): UserAccount => {
  const data = localStorage.getItem('current_logged_user');
  if (!data) {
    const defaultUser: UserAccount = {
      id: 'user_butcher_ckt',
      username: 'butcher_ckt',
      role: 'butcher',
      storeId: 'store_ckt',
      storeName: 'TDN Cikut',
      fullName: 'Butcher TDN Cikut',
      createdAt: '2026-01-01',
    };
    localStorage.setItem('current_logged_user', JSON.stringify(defaultUser));
    return defaultUser;
  }
  return JSON.parse(data);
};

export const setCurrentUser = (user: UserAccount) => {
  localStorage.setItem('current_logged_user', JSON.stringify(user));
};

export const DEFAULT_COGS_MASTER: CogsMaster[] = [
  { id: 'cogs_1', itemCode: 'DF-01', itemName: 'HQ 41/42/44/45 (Daging Fresh)', category: 'DAGING FRESH', cogsPerKg: 102000, defaultPricePerKg: 125000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_2', itemCode: 'DF-02', itemName: 'DG RNDG BEKU 1kg', category: 'DAGING FRESH', cogsPerKg: 96000, defaultPricePerKg: 118000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_3', itemCode: 'SH-01', itemName: 'FQ 60 / SHANK (Daging Ekonomis)', category: 'SHANKLE', cogsPerKg: 85200, defaultPricePerKg: 105000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_4', itemCode: 'DP-01', itemName: 'D Premium Lokal (Sirloin/Ribeye)', category: 'DAGING PREMIUM', cogsPerKg: 127000, defaultPricePerKg: 155000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_5', itemCode: 'DP-02', itemName: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', cogsPerKg: 103000, defaultPricePerKg: 135000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_6', itemCode: 'RW-01', itemName: 'Rawon Curah (FQ 106/105)', category: 'RAWON', cogsPerKg: 86500, defaultPricePerKg: 110000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_7', itemCode: 'DF-03', itemName: 'RENDANG BEKU CURAH', category: 'DAGING FRESH', cogsPerKg: 102550, defaultPricePerKg: 125000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
  { id: 'cogs_8', itemCode: 'DF-04', itemName: 'DAGING KHUSUS TDN', category: 'DAGING FRESH', cogsPerKg: 96000, defaultPricePerKg: 115000, updatedAt: '2026-08-01', updatedBy: 'MD Pusat' },
];

export const normalizeCogsList = (list: any[]): CogsMaster[] => {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_COGS_MASTER;
  return list.map((c, idx) => {
    const fallbackDef = DEFAULT_COGS_MASTER[idx] || DEFAULT_COGS_MASTER.find((d) => d.id === c.id || d.category === c.category);
    const catUpper = (c.category || fallbackDef?.category || 'DAGING FRESH').toUpperCase();
    const catCode = catUpper.includes('PREM') ? 'DP' : catUpper.includes('SHANK') ? 'SH' : catUpper.includes('RAWON') ? 'RW' : 'DF';
    const itemCode = c.itemCode || fallbackDef?.itemCode || `${catCode}-${String(idx + 1).padStart(2, '0')}`;
    const itemName = c.itemName || c.planName || fallbackDef?.itemName || `Bahan ${catUpper} #${idx + 1}`;
    const defaultPricePerKg = Number(c.defaultPricePerKg || c.sellingPricePerKg) || fallbackDef?.defaultPricePerKg || Math.round(Number(c.cogsPerKg || 100000) * 1.25);
    const updatedBy = c.updatedBy || fallbackDef?.updatedBy || 'MD Pusat';
    const updatedAt = c.updatedAt || '2026-08-01';
    return {
      id: c.id || `cogs_${idx + 1}`,
      itemCode,
      itemName,
      category: catUpper,
      cogsPerKg: Number(c.cogsPerKg) || fallbackDef?.cogsPerKg || 102000,
      defaultPricePerKg,
      updatedAt,
      updatedBy,
    };
  });
};

export const getCogsMaster = (): CogsMaster[] => {
  const data = localStorage.getItem('cogs_master');
  if (!data) return DEFAULT_COGS_MASTER;
  try {
    const parsed = JSON.parse(data);
    return normalizeCogsList(parsed);
  } catch (e) {
    return DEFAULT_COGS_MASTER;
  }
};

export const saveCogsMaster = (cogs: CogsMaster[]) => {
  const normalized = normalizeCogsList(cogs);
  localStorage.setItem('cogs_master', JSON.stringify(normalized));
  postApiBackground('/api/cogs', normalized);
};

export const getStockAdjustments = (): StockAdjustment[] => {
  const data = localStorage.getItem('stock_adjustments');
  return data ? JSON.parse(data) : [];
};

export const saveStockAdjustments = (adjs: StockAdjustment[]) => {
  localStorage.setItem('stock_adjustments', JSON.stringify(adjs));
  postApiBackground('/api/adjustments', adjs);
};

export const getClosingPlanRecords = (): ClosingPlanRecord[] => {
  const data = localStorage.getItem('closing_plan_records');
  return data ? JSON.parse(data) : [];
};

export const saveClosingPlanRecords = (records: ClosingPlanRecord[]) => {
  localStorage.setItem('closing_plan_records', JSON.stringify(records));
  postApiBackground('/api/closing-records', records);
};

export const getThawingItems = (): ThawingItem[] => {
  const data = localStorage.getItem('thawing_items');
  return data ? JSON.parse(data) : [];
};

export const saveThawingItems = (items: ThawingItem[]) => {
  localStorage.setItem('thawing_items', JSON.stringify(items));
  postApiBackground('/api/thawing-items', items);
};

export const getFabricationSegments = (): FabricationSegment[] => {
  const data = localStorage.getItem('fabrication_segments');
  return data ? JSON.parse(data) : [];
};

export const saveFabricationSegments = (segments: FabricationSegment[]) => {
  localStorage.setItem('fabrication_segments', JSON.stringify(segments));
  postApiBackground('/api/fabrication-segments', segments);
};

export const getDailyReports = (): DailyClosingReport[] => {
  const data = localStorage.getItem('daily_reports');
  return data ? JSON.parse(data) : [];
};

export const saveDailyReports = (reports: DailyClosingReport[]) => {
  localStorage.setItem('daily_reports', JSON.stringify(reports));
  postApiBackground('/api/reports', reports);
};

export const getLossConfig = (): LossAlertConfig => {
  const data = localStorage.getItem('loss_config');
  return data ? JSON.parse(data) : DEFAULT_CONFIG;
};

export const saveLossConfig = (config: LossAlertConfig) => {
  localStorage.setItem('loss_config', JSON.stringify(config));
  postApiBackground('/api/loss-config', config);
};

export const resetDatabase = async () => {
  localStorage.removeItem('thawing_items');
  localStorage.removeItem('fabrication_segments');
  localStorage.removeItem('stock_adjustments');
  localStorage.removeItem('closing_plan_records');
  localStorage.removeItem('daily_reports');
  try {
    await fetch('/api/database/reset', { method: 'POST' });
  } catch (e) {
    console.warn('Backend reset notice:', e);
  }
};
