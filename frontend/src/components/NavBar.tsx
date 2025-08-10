import React from 'react';
import styles from './nav.module.css';

interface Props {
  view: string;
  setView: (v: string) => void;
}

const views = [
  { key: 'cashier', label: 'Cashier' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'serving', label: 'Serving' },
  { key: 'manager', label: 'Manager' },
];

const NavBar: React.FC<Props> = ({ view, setView }) => {
  return (
    <nav
      className={styles.nav}
    >
      {views.map(v => (
        <button
          key={v.key}
          className={styles.navtabs}
          onClick={() => setView(v.key)}
          style={{
            background: v.key === view ? '#555' : 'transparent',
          }}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
};

export default NavBar; 