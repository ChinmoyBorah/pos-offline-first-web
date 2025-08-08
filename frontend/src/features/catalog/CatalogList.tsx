import React, { useState } from 'react';
import { Product } from './types';

interface Props {
  products: Product[];
  onAdd: (productId: string) => void;
}

const CatalogList: React.FC<Props> = ({ products, onAdd }) => {
  const [query, setQuery] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
      <h2>Catalog</h2>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
      />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {filtered.map(product => (
          <li
            key={product.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              borderBottom: '1px solid #eee',
              paddingBottom: '0.5rem'
            }}
          >
            <span>
              {product.name} - ${product.price.toFixed(2)}
            </span>
            <button onClick={() => onAdd(product.id)}>Add</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CatalogList; 