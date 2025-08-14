import React from "react";
import styles from "./nav.module.css";

interface Props {
  view: string;
  setDashboard: (v: boolean) => void;
}

const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
const views = [
  { key: "cashier", label: "Cashier" },
  { key: "kitchen", label: "Kitchen" },
  { key: "serving", label: "Serving" },
  { key: "manager", label: "Manager" },
];

const NavBar: React.FC<Props> = ({ view, setDashboard }) => {
  const visible = views.filter((v) => v.key === ROLE);
  return (
    <nav className={styles.nav}>
      {visible.map((v) => (
        <button
          key={v.key}
          className={styles.navtabs}
          onClick={() => {
            setDashboard(false);
          }}
          style={{
            background: v.key === view ? "#555" : "transparent",
          }}>
          {v.label}
        </button>
      ))}
    </nav>
  );
};

export default NavBar;
