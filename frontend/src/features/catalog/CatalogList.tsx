import React, { useState } from "react";
import { Product } from "./types";

interface Props {
  products: Product[];
  onAdd: (productId: string) => void;
  onOpenDashboard: () => void;
}

const CatalogList: React.FC<Props> = ({ products, onAdd, onOpenDashboard }) => {
  const [query, setQuery] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
      <h2 style={{ margin: 0 }}>Catalog</h2>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "500px",
        }}>
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: "500px", padding: "0.5rem", margin: "0.5rem 0" }}
        />
        <button onClick={onOpenDashboard}>Print Dashboard</button>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filtered.map((product) => (
          <li
            key={product.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1px solid #eee",
              padding: "0.5rem 0",
              maxWidth: "500px",
            }}>
            <span>
              {product.name} ({product.quantity ?? 0}) - $
              {product.price.toFixed(2)}
            </span>
            <button onClick={() => onAdd(product.id)}>Add</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CatalogList;
