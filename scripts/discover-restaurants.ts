import "dotenv/config";

const TOAST_API_HOSTNAME = process.env.TOAST_API_HOSTNAME!;
const TOAST_CLIENT_ID = process.env.TOAST_CLIENT_ID!;
const TOAST_CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET!;

async function main() {
  console.log("Authenticating with Toast API...");

  const authRes = await fetch(
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

  if (!authRes.ok) {
    console.error("Auth failed:", authRes.status, await authRes.text());
    process.exit(1);
  }

  const auth = await authRes.json();
  console.log("Auth successful! Token type:", auth.tokenType);
  console.log("Expires in:", auth.expiresIn, "seconds");

  const token = auth.accessToken;

  // Try to discover restaurants via the management group
  // The partners API endpoint returns accessible restaurants
  console.log("\nDiscovering restaurants...");

  // Try fetching restaurant info for any known GUIDs
  const guids = process.env.TOAST_RESTAURANT_GUIDS?.split(",").filter(Boolean);

  if (guids && guids.length > 0) {
    console.log(`\nFound ${guids.length} restaurant GUIDs in env.`);
    for (const guid of guids) {
      try {
        const res = await fetch(
          `${TOAST_API_HOSTNAME}/restaurants/v1/restaurants/${guid.trim()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Toast-Restaurant-External-ID": guid.trim(),
            },
          }
        );
        if (res.ok) {
          const info = await res.json();
          console.log(`\n--- Restaurant: ${guid.trim()} ---`);
          console.log("  Name:", info.general?.name);
          console.log("  Location:", info.general?.locationName);
          console.log("  Timezone:", info.general?.timeZone);
          console.log(
            "  Address:",
            [
              info.location?.address1,
              info.location?.city,
              info.location?.stateCode,
            ]
              .filter(Boolean)
              .join(", ")
          );
        } else {
          console.log(`  GUID ${guid.trim()}: ${res.status} ${await res.text()}`);
        }
      } catch (err) {
        console.error(`  Error fetching ${guid.trim()}:`, err);
      }
    }
  } else {
    console.log(
      "No TOAST_RESTAURANT_GUIDS set. Set them in .env to test API calls."
    );
    console.log(
      "You can find GUIDs in your Toast admin portal or from your Toast rep."
    );
  }

  // Test orders endpoint if we have at least one GUID
  if (guids && guids.length > 0) {
    const testGuid = guids[0].trim();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const bizDate = yesterday
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    console.log(
      `\nTesting orders API for ${testGuid} on ${bizDate}...`
    );
    try {
      const ordersRes = await fetch(
        `${TOAST_API_HOSTNAME}/orders/v2/ordersBulk?businessDate=${bizDate}&pageSize=5&page=0`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Toast-Restaurant-External-ID": testGuid,
          },
        }
      );

      if (ordersRes.ok) {
        const orders = await ordersRes.json();
        console.log(`  Got ${orders.length} orders (page 0, max 5)`);
        if (orders.length > 0) {
          const o = orders[0];
          console.log(`  First order: ${o.guid}`);
          console.log(`  Business date: ${o.businessDate}`);
          console.log(`  Checks: ${o.checks?.length || 0}`);
        }
      } else {
        console.log(
          `  Orders API error: ${ordersRes.status} ${await ordersRes.text()}`
        );
      }
    } catch (err) {
      console.error("  Error:", err);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
