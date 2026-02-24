import type {
  MECategory,
  MEOrderDetailResponse,
  MEOrderStatus,
  MEOrderSummary,
  MERestaurantUnit,
  MERestaurantUnitsResponse,
  MEVendor,
} from "./marginedge-types";

const MARGINEDGE_API_BASE = "https://api.marginedge.com/public";

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestTime = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, 1000 - (now - lastRequestTime));
  if (waitMs > 0) {
    await delay(waitMs);
  }
  lastRequestTime = Date.now();
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = requestQueue.then(async () => {
    await rateLimitedDelay();
    return fn();
  });

  requestQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

function getApiKeyOrThrow(): string {
  const apiKey = process.env.MARGINEDGE_API_KEY;
  if (!apiKey) {
    throw new Error("MARGINEDGE_API_KEY is not set");
  }
  return apiKey;
}

export function getConfiguredMarginEdgeUnitId(): string | null {
  const unitId = process.env.MARGINEDGE_RESTAURANT_UNIT_ID?.trim();
  return unitId || null;
}

function resolveUnitId(unitId?: string): string {
  const resolved = unitId || getConfiguredMarginEdgeUnitId();
  if (!resolved) {
    throw new Error("MARGINEDGE_RESTAURANT_UNIT_ID is not set");
  }
  return resolved;
}

async function marginedgeFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const apiKey = getApiKeyOrThrow();
  const url = new URL(`${MARGINEDGE_API_BASE}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return enqueueRequest(async () => {
    const res = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MarginEdge API ${path} failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<T>;
  });
}

async function fetchAllPages<T>(
  path: string,
  listKey: string,
  params?: Record<string, string>
): Promise<T[]> {
  const rows: T[] = [];
  let nextPage: string | undefined;

  do {
    const pageParams: Record<string, string> = {
      ...(params || {}),
    };

    if (nextPage) {
      pageParams.nextPage = nextPage;
    }

    const response = await marginedgeFetch<
      { nextPage?: string } & Record<string, unknown>
    >(path, pageParams);

    const pageRows = (response[listKey] as T[] | undefined) || [];
    rows.push(...pageRows);

    nextPage = response.nextPage || undefined;
  } while (nextPage);

  return rows;
}

export async function getRestaurantUnits(): Promise<MERestaurantUnit[]> {
  const data = await marginedgeFetch<MERestaurantUnitsResponse>(
    "/restaurantUnits"
  );
  return data.restaurants || [];
}

export async function getAllCategories(unitId?: string): Promise<MECategory[]> {
  const resolvedUnitId = resolveUnitId(unitId);
  return fetchAllPages<MECategory>("/categories", "categories", {
    restaurantUnitId: resolvedUnitId,
  });
}

export async function getAllVendors(unitId?: string): Promise<MEVendor[]> {
  const resolvedUnitId = resolveUnitId(unitId);
  return fetchAllPages<MEVendor>("/vendors", "vendors", {
    restaurantUnitId: resolvedUnitId,
  });
}

export async function getOrdersByCreatedDateRange(
  startDate: string,
  endDate: string,
  status: MEOrderStatus = "CLOSED",
  unitId?: string
): Promise<MEOrderSummary[]> {
  const resolvedUnitId = resolveUnitId(unitId);
  return fetchAllPages<MEOrderSummary>("/orders", "orders", {
    restaurantUnitId: resolvedUnitId,
    startDate,
    endDate,
    orderStatus: status,
  });
}

export async function getOrderDetail(
  orderId: string,
  unitId?: string
): Promise<MEOrderDetailResponse> {
  const resolvedUnitId = resolveUnitId(unitId);
  return marginedgeFetch<MEOrderDetailResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    restaurantUnitId: resolvedUnitId,
  });
}
