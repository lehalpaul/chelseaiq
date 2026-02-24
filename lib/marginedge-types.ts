export type MEOrderStatus =
  | "PREPROCESSING"
  | "EDI_PENDING"
  | "IMAGE_PENDING"
  | "INITIAL_REVIEW"
  | "RECONCILIATION"
  | "FINAL_REVIEW"
  | "AM_REVIEW"
  | "PENDING_APPROVAL"
  | "CLOSED";

export interface MERestaurantUnit {
  id: number;
  name: string;
}

export interface MECategory {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  accountingCode: number | null;
}

export interface MEVendorAccount {
  vendorAccountNumber: string;
}

export interface MEVendor {
  vendorId: string;
  vendorName: string;
  centralVendorId: string;
  vendorAccounts?: MEVendorAccount[];
}

export interface MEOrderSummary {
  orderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  createdDate: string;
  vendorId: string;
  vendorName: string;
  customerNumber: string;
  paymentAccount: string;
  orderTotal: number;
  status: MEOrderStatus;
}

export interface MELineItem {
  vendorItemCode?: string;
  vendorItemName?: string;
  companyConceptProductId?: string;
  categoryId?: string;
  packagingId?: string;
  quantity?: number;
  unitPrice?: number;
  linePrice: number;
}

export interface MEAttachment {
  attachmentId: number;
  attachmentUrl: string;
}

export interface MEOrderDetailResponse {
  orderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  createdDate: string;
  vendorId: string;
  vendorName: string;
  customerNumber: string;
  paymentAccount: string;
  orderTotal: number;
  tax: number;
  deliveryCharges: number;
  otherCharges: number;
  otherDescription?: string;
  creditAmount: number;
  isCredit: boolean;
  inputTaxCredits?: number;
  status: MEOrderStatus;
  lineItems: MELineItem[];
  attachments?: MEAttachment[];
}

export interface MEOrderListResponse {
  nextPage?: string;
  orders: MEOrderSummary[];
}

export interface MECategoriesResponse {
  nextPage?: string;
  categories: MECategory[];
}

export interface MEVendorsResponse {
  nextPage?: string;
  vendors: MEVendor[];
}

export interface MERestaurantUnitsResponse {
  restaurants: MERestaurantUnit[];
}
