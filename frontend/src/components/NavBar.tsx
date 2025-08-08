import React from 'react';

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
      style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: '#333',
        color: '#fff',
      }}
    >
      {views.map(v => (
        <button
          key={v.key}
          onClick={() => setView(v.key)}
          style={{
            background: v.key === view ? '#555' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
          }}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
};

export default NavBar; 