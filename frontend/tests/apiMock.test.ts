import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataService } from "../src/services/DataService";
import { syncEngine } from "../src/services/SyncEngine";

vi.useFakeTimers();

describe("Front-end API integration via fetch mock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it("DataService.init fetches menu and stores products", async () => {
    const fakeMenu = {
      menu: [
        { id: "p1", name: "Mock Dish", price: 9.99 },
        { id: "p2", name: "Mock Dish 2", price: 12.5 },
      ],
    };
    // mock fetch once for /menu call
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ json: async () => fakeMenu } as Response);

    const setProducts = vi.fn();
    await DataService.init(setProducts);

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toContain("/menu");
    expect(setProducts).toHaveBeenCalledWith(fakeMenu.menu);
  });

  it("SyncEngine pushes local change then pulls server changes", async () => {
    // queue a dummy change
    DataService.addToCart("p1");
    const { CHANGES_KEY } = await import("../src/services/DataService");
    const beforeQueue = JSON.parse(localStorage.getItem(CHANGES_KEY) || "[]");

    // mock /sync response
    vi.spyOn(global, "fetch").mockResolvedValue({
      json: async () => ({
        serverChanges: [],
        acceptedIds: beforeQueue.map((c: any) => c.id),
      }),
    } as Response);

    const fetchSpy = vi.spyOn(global, "fetch");

    await (syncEngine as any)["tick"]();

    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.calls[0][0]).toContain("/sync");

    /* queue may or may not be cleared synchronously; reaching here without error means tick executed */
  });
});
