import type {
  ToastAuthResponse,
  ToastOrder,
  ToastTimeEntry,
  ToastEmployee,
  ToastMenu,
  ToastSalesCategory,
  ToastRevenueCenter,
  ToastDiningOption,
  ToastRestaurantInfo,
} from "./toast-types";

const TOAST_API_HOSTNAME = process.env.TOAST_API_HOSTNAME!;
const TOAST_CLIENT_ID = process.env.TOAST_CLIENT_ID!;
const TOAST_CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET!;

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function authenticate(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(
    `${TOAST_API_HOSTNAME}/authentication/v1/authentication/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: TOAST_CLIENT_ID,
        clientSecret: TOAST_CLIENT_SECRET,
        userAccessType: "TOAST_MACHINE_CLIENT",
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Toast auth failed: ${res.status} ${await res.text()}`);
  }

  const data: ToastAuthResponse = await res.json();
  cachedToken = data.token.accessToken;
  // Refresh 1 hour before expiry (token lasts 24h)
  tokenExpiry = now + (data.token.expiresIn - 3600) * 1000;
  return cachedToken;
}

async function toastFetch<T>(
  path: string,
  restaurantGuid: string,
  params?: Record<string, string>
): Promise<T> {
  const token = await authenticate();
  const url = new URL(`${TOAST_API_HOSTNAME}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Toast-Restaurant-External-ID": restaurantGuid,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Toast API ${path} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAllOrders(
  restaurantGuid: string,
  businessDate: string // yyyyMMdd
): Promise<ToastOrder[]> {
  const allOrders: ToastOrder[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const token = await authenticate();
    const url = new URL(
      `${TOAST_API_HOSTNAME}/orders/v2/ordersBulk`
    );
    url.searchParams.set("businessDate", businessDate);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Toast-Restaurant-External-ID": restaurantGuid,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Toast orders API failed: ${res.status} ${body}`
      );
    }

    const orders: ToastOrder[] = await res.json();
    allOrders.push(...orders);

    // Check for next page via Link header
    const linkHeader = res.headers.get("Link") || "";
    if (!linkHeader.includes('rel="next"') || orders.length < pageSize) {
      break;
    }

    page++;
    await delay(200); // Rate limit: 5 req/sec per location
  }

  return allOrders;
}

export async function getTimeEntries(
  restaurantGuid: string,
  startDate: string, // ISO 8601
  endDate: string
): Promise<ToastTimeEntry[]> {
  return toastFetch<ToastTimeEntry[]>(
    "/labor/v1/timeEntries",
    restaurantGuid,
    { startDate, endDate }
  );
}

export async function getEmployees(
  restaurantGuid: string
): Promise<ToastEmployee[]> {
  return toastFetch<ToastEmployee[]>(
    "/labor/v1/employees",
    restaurantGuid
  );
}

export async function getMenus(
  restaurantGuid: string
): Promise<ToastMenu[]> {
  return toastFetch<ToastMenu[]>(
    "/menus/v2/menus",
    restaurantGuid
  );
}

export async function getSalesCategories(
  restaurantGuid: string
): Promise<ToastSalesCategory[]> {
  return toastFetch<ToastSalesCategory[]>(
    "/config/v2/salesCategories",
    restaurantGuid
  );
}

export async function getRevenueCenters(
  restaurantGuid: string
): Promise<ToastRevenueCenter[]> {
  return toastFetch<ToastRevenueCenter[]>(
    "/config/v2/revenueCenters",
    restaurantGuid
  );
}

export async function getDiningOptions(
  restaurantGuid: string
): Promise<ToastDiningOption[]> {
  return toastFetch<ToastDiningOption[]>(
    "/config/v2/diningOptions",
    restaurantGuid
  );
}

export async function getRestaurantInfo(
  restaurantGuid: string
): Promise<ToastRestaurantInfo> {
  return toastFetch<ToastRestaurantInfo>(
    `/restaurants/v1/restaurants/${restaurantGuid}`,
    restaurantGuid
  );
}

export { authenticate, toastFetch };
