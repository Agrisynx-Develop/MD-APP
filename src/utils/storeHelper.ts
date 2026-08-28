import { Store } from '../types';

/**
 * Matches an entity's store identifier against a target Store.
 * Supports store IDs ('1', 'store_ckr'), store codes ('CKR', 'ckr'),
 * store names ('TDN CKR', 'tdn ckr'), and handles untagged entities gracefully.
 */
export function matchStoreEntity(
  entityStoreId: string | undefined | null,
  targetStore: { id: string; code?: string; name?: string } | undefined | null
): boolean {
  if (!targetStore) return true;
  if (!entityStoreId || entityStoreId.trim() === '') {
    // Untagged entities belong to the default/primary store
    return true;
  }

  const eId = entityStoreId.toString().toLowerCase().trim();
  const sId = (targetStore.id || '').toString().toLowerCase().trim();
  const sCode = (targetStore.code || '').toString().toLowerCase().trim();
  const sName = (targetStore.name || '').toString().toLowerCase().trim();

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
