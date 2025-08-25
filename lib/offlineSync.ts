import { set, get, del, keys } from 'idb-keyval';

export async function saveDepotOffline(depot: object) {
  await set(`depot_${Date.now()}`, depot);
}

export async function syncDepotsOnline(sendToFirestore: (depot: object) => Promise<void>) {
  const allKeys = await keys();
  const depotKeys = allKeys.filter((k: unknown) => typeof k === 'string' && k.startsWith('depot_'));
  for (const key of depotKeys) {
    const depot = await get(key);
    try {
      await sendToFirestore(depot);
      await del(key);
    } catch {
      // Håndter evt. feil
    }
  }
}

export function setupDepotSync(sendToFirestore: (depot: object) => Promise<void>) {
  window.addEventListener('online', () => {
    syncDepotsOnline(sendToFirestore);
  });
}
