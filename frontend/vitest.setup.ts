import "@testing-library/jest-dom";
import { vi } from "vitest";

// Inject a predictable role so LocalStorage keys are isolated per test run
vi.stubGlobal("import.meta", { env: { VITE_ROLE: "test" } });
