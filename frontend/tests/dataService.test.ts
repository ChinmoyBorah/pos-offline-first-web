import { describe, it, expect, beforeEach } from "vitest";
import { DataService } from "../src/services/DataService";

// basic cart tests

describe("DataService cart flow", () => {
  beforeEach(() => localStorage.clear());

  it("adds item to cart", () => {
    DataService.addToCart("p1");
    expect(DataService.getCart()).toEqual({ p1: 1 });
  });

  it("checkout clears cart", () => {
    DataService.addToCart("p1");
    DataService.createOrder(DataService.getCart());
    expect(DataService.getCart()).toEqual({});
  });
});
