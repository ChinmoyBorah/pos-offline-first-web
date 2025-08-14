import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CatalogList from "../src/features/catalog/CatalogList";

const products = [{ id: "1", name: "Burger", price: 5.5 }];

describe("CatalogList", () => {
  it("filters and adds item", () => {
    const addSpy = vi.fn();
    render(
      <CatalogList
        products={products}
        onAdd={addSpy}
        onOpenDashboard={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "bur" },
    });
    fireEvent.click(screen.getByText(/add/i));

    expect(addSpy).toHaveBeenCalledWith("1");
  });
});
