import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminStats } from "./use-admin-stats";
import { resolveRange } from "./admin-stats";

// El hook usa useAuth() sólo para los headers; lo mockeamos para no montar el
// AuthProvider entero (que a su vez pega contra /me al montar).
//
// `getAuthHeader` se crea UNA sola vez a propósito: es dependencia del useCallback
// del hook, así que devolver una función nueva en cada render dispara un loop de
// renders (y el warning "Maximum update depth exceeded"). En producción viene de
// un useCallback([token]) (useProvideAuth.ts:52), o sea estable — el mock tiene
// que replicar eso o testea una situación que no existe.
vi.mock("@/features/auth/AuthContext", () => {
  const getAuthHeader = () => ({ Authorization: "Bearer t" });
  return { useAuth: () => ({ getAuthHeader }) };
});

const STATS = {
  kpis: {
    postulaciones: { value: 834, deltaPct: 12 },
    candidatos: { value: 226, withCv: 180, withoutCv: 46 },
    puestosActivos: { value: 5, drafts: 2 },
    hoy: 7,
  },
  byMonth: [{ ym: "2026-07", label: "jul", count: 40 }],
  byArea: [{ area: "Administración", count: 12 }],
  topJobs: [{ jobId: "contador", title: "Contador/a", count: 9 }],
  spontaneousVsLinked: { spontaneous: 300, linked: 534 },
};

function mockFetch(impl?: (url: string) => unknown) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = impl ? impl(url) : url.includes("/admin/stats") ? STATS : { items: [] };
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("useAdminStats", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("toma los KPIs de /admin/stats, no del array de /admin/cv", async () => {
    const spy = mockFetch();
    const { result } = renderHook(() => useAdminStats(resolveRange("all", new Date())));

    await waitFor(() => expect(result.current.stats).not.toBeNull());
    // 834 > 500: es justo el número que el cálculo viejo en el cliente no podía
    // representar, porque /admin/cv devuelve como mucho 500 filas.
    expect(result.current.stats?.kpis.postulaciones.value).toBe(834);
    expect(result.current.stats?.kpis.candidatos.value).toBe(226);
    expect(spy.mock.calls.some(([u]) => String(u).includes("/admin/stats"))).toBe(true);
  });

  it("manda el rango como instantes ISO en el querystring", async () => {
    const spy = mockFetch();
    const now = new Date("2026-07-15T12:00:00Z");
    renderHook(() => useAdminStats(resolveRange("month", now)));

    await waitFor(() => {
      const call = spy.mock.calls.find(([u]) => String(u).includes("/admin/stats"));
      expect(call).toBeTruthy();
      const url = String(call![0]);
      expect(url).toContain("date_from=");
      // ISO con Z: sin esto el server interpretaría la fecha en otra zona.
      expect(decodeURIComponent(url)).toMatch(/date_from=\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
    });
  });

  it("sin rango (todo el histórico) no manda date_from ni date_to", async () => {
    const spy = mockFetch();
    renderHook(() => useAdminStats(resolveRange("all", new Date())));

    await waitFor(() => {
      const call = spy.mock.calls.find(([u]) => String(u).includes("/admin/stats"));
      expect(call).toBeTruthy();
      expect(String(call![0])).not.toContain("date_from");
      expect(String(call![0])).not.toContain("date_to");
    });
  });

  it("sigue trayendo /admin/cv para los drill-downs", async () => {
    const spy = mockFetch((url) =>
      url.includes("/admin/stats") ? STATS : { items: [{ created_at: "2026-07-01T10:00:00Z" }] },
    );
    const { result } = renderHook(() => useAdminStats(resolveRange("all", new Date())));

    await waitFor(() => expect(result.current.raw?.cvs.length).toBe(1));
    expect(spy.mock.calls.some(([u]) => String(u).endsWith("/admin/cv"))).toBe(true);
  });

  it("si falla /admin/cv los KPIs se muestran igual", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/stats"))
          return { ok: true, status: 200, json: async () => STATS } as Response;
        return { ok: false, status: 500, json: async () => ({}), text: async () => "boom" } as unknown as Response;
      }),
    );
    const { result } = renderHook(() => useAdminStats(resolveRange("all", new Date())));

    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(result.current.stats?.kpis.postulaciones.value).toBe(834);
    expect(result.current.error).toBeNull();
    expect(result.current.raw?.cvs).toEqual([]);
  });

  it("si falla /admin/stats expone el error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({ ok: false, status: 500, json: async () => ({ detail: "boom" }), text: async () => "boom" }) as unknown as Response,
      ),
    );
    const { result } = renderHook(() => useAdminStats(resolveRange("all", new Date())));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.stats).toBeNull();
  });
});
