# MarginEdge Public API

## Overview

MarginEdge is a restaurant management platform that provides invoice processing, food costing, and inventory management. The public API supports one-way data retrieval from MarginEdge.

## Environment

| | |
|---|---|
| **Base URL** | `https://api.marginedge.com/public` |
| **Authentication** | `X-Api-Key` header |
| **Developer Portal** | https://developer.marginedge.com |

## Authentication

All requests require the `X-Api-Key` header:

```bash
curl https://api.marginedge.com/public/categories?restaurantUnitId=166613240 \
  -H "X-Api-Key: ${MARGINEDGE_API_KEY}"
```

## Environment Variables

| Variable | Description |
|---|---|
| `MARGINEDGE_API_KEY` | API key for authentication |
| `MARGINEDGE_RESTAURANT_UNIT_ID` | Restaurant unit ID (`166613240`) |

## Endpoints

---

### GET `/restaurantUnits`

Returns the name and identifier for each restaurant unit the API key has access to.

**Parameters:** None

**Response:**
```json
{
  "restaurants": [
    { "name": "string", "id": "number" }
  ]
}
```

---

### GET `/restaurantUnits/groupCategories`

Returns a list of group categories accessible to the user.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `conceptId` | No | Filter by concept ID |
| `companyId` | No | Filter by company ID |

**Response:**
```json
{
  "groupCategories": [
    {
      "id": "string",
      "name": "string",
      "companyId": "number",
      "companyName": "string",
      "conceptId": "number",
      "conceptName": "string",
      "permission": "string"
    }
  ]
}
```

---

### GET `/restaurantUnits/groups`

Returns a list of restaurant unit groups accessible to the user.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `conceptId` | No | Filter by concept ID |
| `companyId` | No | Filter by company ID |

**Response:**
```json
{
  "groups": [
    {
      "id": "string",
      "name": "string",
      "companyId": "number",
      "companyName": "string",
      "conceptId": "number",
      "conceptName": "string",
      "groupCategoryId": "string",
      "groupCategoryName": "string",
      "lastModifiedDate": "string",
      "units": [
        { "unitId": "number", "unitName": "string" }
      ]
    }
  ]
}
```

---

### GET `/orders`

Returns key fields for a paginated set of orders created within a date range and matching a status.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `restaurantUnitId` | Yes | Restaurant unit ID |
| `startDate` | Yes | Start of created date range |
| `endDate` | Yes | End of created date range |
| `orderStatus` | No | Filter by invoice status |
| `nextPage` | No | Pagination cursor |

**Response:**
```json
{
  "nextPage": "string",
  "orders": [
    {
      "orderId": "string",
      "invoiceNumber": "string",
      "invoiceDate": "string",
      "createdDate": "string",
      "vendorId": "string",
      "vendorName": "string",
      "customerNumber": "string",
      "paymentAccount": "string",
      "orderTotal": "number",
      "status": "string"
    }
  ]
}
```

---

### GET `/orders/:orderId`

Returns detailed information for an individual order.

**Parameters:**

| Name | In | Required | Description |
|---|---|---|---|
| `orderId` | path | Yes | Order ID |
| `restaurantUnitId` | query | Yes | Restaurant unit ID |

**Response:**
```json
{
  "orderId": "string",
  "invoiceNumber": "string",
  "invoiceDate": "string",
  "createdDate": "string",
  "vendorId": "string",
  "vendorName": "string",
  "customerNumber": "string",
  "paymentAccount": "string",
  "orderTotal": "number",
  "tax": "number",
  "deliveryCharges": "number",
  "otherCharges": "number",
  "otherDescription": "string",
  "creditAmount": "number",
  "isCredit": "boolean",
  "inputTaxCredits": "number",
  "status": "string",
  "lineItems": [
    {
      "vendorItemCode": "string",
      "vendorItemName": "string",
      "companyConceptProductId": "string",
      "categoryId": "string",
      "packagingId": "string",
      "quantity": "number",
      "unitPrice": "number",
      "linePrice": "number"
    }
  ],
  "attachments": [
    { "attachmentId": "number", "attachmentUrl": "string" }
  ]
}
```

---

### GET `/products`

Returns a paginated set of products for the specified restaurant unit.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `restaurantUnitId` | Yes | Restaurant unit ID |
| `nextPage` | No | Pagination cursor |

**Response:**
```json
{
  "nextPage": "string",
  "products": [
    {
      "companyConceptProductId": "string",
      "centralProductId": "string",
      "productName": "string",
      "latestPrice": "number",
      "reportByUnit": "string",
      "taxExempt": "boolean",
      "itemCount": "number",
      "categories": [
        { "categoryId": "string", "percentAllocation": "number" }
      ]
    }
  ]
}
```

---

### GET `/categories`

Returns a paginated set of categories for the specified restaurant unit.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `restaurantUnitId` | Yes | Restaurant unit ID |
| `nextPage` | No | Pagination cursor |

**Response:**
```json
{
  "nextPage": "string",
  "categories": [
    {
      "categoryId": "string",
      "categoryName": "string",
      "categoryType": "string",
      "accountingCode": "number"
    }
  ]
}
```

---

### GET `/vendors`

Returns a paginated list of vendors used by the specified restaurant unit.

**Parameters:**

| Name | Required | Description |
|---|---|---|
| `restaurantUnitId` | Yes | Restaurant unit ID |
| `nextPage` | No | Pagination cursor |

**Response:**
```json
{
  "nextPage": "string",
  "vendors": [
    {
      "vendorId": "string",
      "vendorName": "string",
      "centralVendorId": "string",
      "vendorAccounts": [
        { "vendorAccountNumber": "string" }
      ]
    }
  ]
}
```

---

### GET `/vendors/:vendorId/vendorItems`

Returns a paginated list of vendor items for the specified vendor.

**Parameters:**

| Name | In | Required | Description |
|---|---|---|---|
| `vendorId` | path | Yes | Vendor ID |
| `restaurantUnitId` | query | Yes | Restaurant unit ID |
| `nextPage` | query | No | Pagination cursor |

**Response:**
```json
{
  "nextPage": "string",
  "vendorItems": [
    {
      "vendorItemCode": "string",
      "vendorId": "string",
      "vendorName": "string",
      "centralVendorId": "string",
      "centralVendorItemId": "string",
      "companyConceptProductId": "string",
      "productName": "string"
    }
  ]
}
```

---

### GET `/vendors/:vendorId/vendorItems/:vendorItemCode/packaging`

Returns a paginated list of packaging options for the specified vendor item.

**Parameters:**

| Name | In | Required | Description |
|---|---|---|---|
| `vendorId` | path | Yes | Vendor ID |
| `vendorItemCode` | path | Yes | Vendor item code |
| `restaurantUnitId` | query | Yes | Restaurant unit ID |

**Response:**
```json
{
  "nextPage": "string",
  "packagings": [
    {
      "packagingId": "string",
      "packagingName": "string",
      "unit": "string",
      "quantity": "number"
    }
  ]
}
```

## Pagination

The API uses **cursor-based pagination** with a fixed page size of **100 records**.

### How it works

1. Make an initial request **without** the `nextPage` parameter to get the first page.
2. The response includes a `nextPage` field containing a cursor key.
3. Pass that cursor as the `nextPage` query parameter in your next request.
4. Repeat until the response contains no further results — all data has been retrieved.

### Example

```bash
# First page
curl "https://api.marginedge.com/public/categories?restaurantUnitId=166613240" \
  -H "X-Api-Key: ${MARGINEDGE_API_KEY}"

# Next page (using the nextPage cursor from the previous response)
curl "https://api.marginedge.com/public/categories?restaurantUnitId=166613240&nextPage=eyJjdXJzb3..." \
  -H "X-Api-Key: ${MARGINEDGE_API_KEY}"
```

### Notes

- Page size is fixed at **100 records**. If fewer than 100 exist, all records are returned in one request.
- Use available filters on each endpoint to limit results and reduce total API requests.

## Rate Limits

**1 request per second** per API key, across all endpoints. Ensure any integration respects this limit.

## Errors

A successful request returns HTTP `200`. Unsuccessful requests return one of the following:

| Code | Name | Description |
|---|---|---|
| `400` | Bad Request | Request is structured or formatted incorrectly. Check that your request conforms to the API specification. |
| `403` | Forbidden | Server understood the request but refused it. Likely your API key doesn't have access to the requested data. Do not retry — verify your access scope. |
| `404` | Not Found | Requested resource couldn't be found. Verify the hostname and endpoint. |
| `500` | Internal Server Error | MarginEdge was unable to fulfill the request. Retry after a reasonable period. If it persists, contact `help@marginedge.com`. |

## Glossary

| Term | Definition |
|---|---|
| **API Key** | Used to identify and authenticate a user for access to the MarginEdge public API. Treat it like a password. |
| **Restaurant Unit ID** | Unique identifier of an individual restaurant in MarginEdge. Most endpoints require it. Use `GET /restaurantUnits` to retrieve all accessible units with their IDs. Endpoints that do **not** require it: `GET /restaurantUnits`, `GET /restaurantUnits/groupCategories`, `GET /restaurantUnits/groups`. |
| **Company ID** | Unique identifier for a company in MarginEdge. Used to filter data at the company level. |
| **Concept ID** | Unique identifier for a restaurant concept in MarginEdge. Used to filter data at the concept level. |
| **Company Concept Product ID** | Unique identifier for a product purchased and used by your restaurant. Each company concept shares a single product database. |
| **Central Product ID** | If present, links a product back to a centralized definition maintained by MarginEdge. Useful for cross-restaurant trend analysis across multiple companies or concepts. |
| **Category-Level Invoice** | An invoice with no line item detail. In `GET /orders/:orderId`, each line item represents a category — containing `categoryId` and `linePrice` but not `vendorItemCode`, `vendorItemName`, `quantity`, or `unitPrice`. Commonly used for rent, utilities, marketing, and janitorial services. [More info](https://help.marginedge.com/hc/en-us/articles/8151891508243-Manual-Category-Level-Invoices-). |
| **Input Tax Credits** | Federal tax paid on purchases levied by governments outside the US. Found on invoices from Canadian restaurants, known as GST (Goods & Services Tax) or HST (Harmonized Sales Tax). |
| **Restaurant Unit Group Categories** | Structures used to classify restaurant unit groups at a higher level. Each has a unique ID, name, and can contain multiple groups. |
| **Restaurant Unit Groups** | Structures used to classify restaurant units at a higher level. Each has a unique ID, name, and can contain multiple units. Groups can optionally belong to a group category. |
| **Group Category Permission** | Controls access to group categories. Values: `PUBLIC` (accessible to all users within the same company-concept) or `RESTRICTED` (limited access based on user permissions). |

### Invoice Statuses

| Status | Description |
|---|---|
| `PREPROCESSING` | Initial processing stage |
| `EDI_PENDING` | Awaiting EDI processing |
| `IMAGE_PENDING` | Awaiting image processing |
| `INITIAL_REVIEW` | First review stage |
| `RECONCILIATION` | Being reconciled |
| `FINAL_REVIEW` | Final review stage |
| `AM_REVIEW` | Account manager review |
| `PENDING_APPROVAL` | Awaiting approval |
| `CLOSED` | Fully processed |

[More info on invoice statuses](https://help.marginedge.com/hc/en-us/articles/218399877-Invoice-FAQs)
