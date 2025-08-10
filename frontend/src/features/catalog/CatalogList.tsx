import React, { useState } from 'react';
import { Product } from './types';
import styles from './catalog.module.css';

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
    <div className={styles.catalogContainer}>
      <h2>Catalog</h2>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className={styles.catalogInput}
      />
      <ul className={styles.catalogList} >
        {filtered.map(product => (
          <li
            key={product.id}
            className={styles.catalogItem}
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