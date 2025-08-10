import React from "react";
import { useSyncStatus } from "../hooks/useSyncStatus";
import styles from "./syncbadge.module.css";

const colors: Record<string, string> = {
  idle: "green",
  syncing: "orange",
  error: "red",
};

const SyncBadge: React.FC = () => {
  const status = useSyncStatus();
  return (
    <div
      className={styles.syncBadge}
      style={{
        background: colors[status],
      }}>
      {status}
    </div>
  );
};

export default SyncBadge;
