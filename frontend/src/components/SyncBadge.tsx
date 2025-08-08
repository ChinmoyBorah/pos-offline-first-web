import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

const colors: Record<string, string> = {
  idle: 'green',
  syncing: 'orange',
  error: 'red',
};

const SyncBadge: React.FC = () => {
  const status = useSyncStatus();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: colors[status],
        color: '#fff',
        padding: '0.25rem 0.5rem',
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      {status}
    </div>
  );
};

export default SyncBadge; 