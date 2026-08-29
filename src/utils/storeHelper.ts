import { Store } from '../types';

/**
 * Matches an entity's store identifier against a target Store.
 * Supports store IDs ('1', 'store_ckr'), store codes ('CKR', 'ckr'),
 * store names ('TDN CKR', 'tdn ckr'), and handles untagged entities gracefully.
 */
export function matchStoreEntity(
  entityStoreId: any,
  targetStore: { id: any; code?: any; name?: any } | undefined | null
): boolean {
  if (!targetStore) return true;
  if (entityStoreId === undefined || entityStoreId === null || String(entityStoreId).trim() === '') {
    // Untagged entities belong to the default/primary store
    return true;
  }

  const eId = String(entityStoreId).toLowerCase().trim();
  const sId = String(targetStore.id || '').toLowerCase().trim();
  const sCode = String(targetStore.code || '').toLowerCase().trim();
  const sName = String(targetStore.name || '').toLowerCase().trim();

  if (eId === sId) return true;
  if (sCode && (eId === sCode || eId === `store_${sCode}` || eId.includes(sCode))) return true;
  if (sName && (eId === sName || eId.includes(sName) || sName.includes(eId))) return true;

  // Specific aliases fallback: ckr <-> ckt backwards compatibility
  if ((eId === 'store_ckr' || eId === 'ckr') && (sCode === 'ckr' || sId === '1')) return true;
  if ((eId === 'store_ckt' || eId === 'ckt') && (sCode === 'ckt' || sCode === 'ckr' || sId === '1')) return true;

  return false;
}

/**
 * Resolves the currently active store based on user role and selections.
 */
export function getEffectiveStore(
  stores: Store[],
  userRole: string,
  selectedStoreIdForMd: string,
  currentUserStoreId?: string
): Store {
  if (stores.length === 0) {
    return {
      id: '1',
      code: 'CKR',
      name: 'TDN CKR',
      city: 'Cikarang',
      createdAt: '2026-01-01',
    };
  }

  if (userRole === 'md') {
    const found = stores.find((s) => s.id === selectedStoreIdForMd || matchStoreEntity(selectedStoreIdForMd, s));
    if (found) return found;
  } else if (currentUserStoreId) {
    const found = stores.find((s) => s.id === currentUserStoreId || matchStoreEntity(currentUserStoreId, s));
    if (found) return found;
  }

  return stores[0];
}

/**
 * Normalizes and fuzzily matches plan names across all components.
 */
export function normalizePlanName(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isMatchPlan(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim();
  const cleanB = b.toLowerCase().trim();
  if (cleanA === cleanB) return true;

  const normA = normalizePlanName(cleanA);
  const normB = normalizePlanName(cleanB);
  if (normA === normB) return true;

  if (normA.length >= 4 && normB.length >= 4) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  // Handle common aliases (e.g., 'rdang' <-> 'rendang', 'prem' <-> 'premium', 'friboy')
  if ((normA.includes('rdang') || normA.includes('rendang')) && (normB.includes('rdang') || normB.includes('rendang'))) {
    const isShankleA = normA.includes('shank') || normA.includes('shankle');
    const isShankleB = normB.includes('shank') || normB.includes('shankle');
    if (isShankleA === isShankleB) return true;
  }

  if (normA.includes('rawon') && normB.includes('rawon')) return true;
  if (normA.includes('friboy') && normB.includes('friboy')) return true;
  if (normA.includes('shank') && normB.includes('shank')) return true;

  return false;
}

