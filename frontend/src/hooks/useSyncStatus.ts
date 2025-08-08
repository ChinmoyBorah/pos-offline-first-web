import { useEffect, useState } from 'react';
import { syncEngine, SyncStatus } from '../services/SyncEngine';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const unsub = syncEngine.subscribe(setStatus);
    return unsub;
  }, []);

  return status;
} 