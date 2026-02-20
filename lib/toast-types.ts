// Toast API response types

export interface ToastAuthToken {
  tokenType: string;
  expiresIn: number;
  accessToken: string;
}

export interface ToastAuthResponse {
  token: ToastAuthToken;
  status: string;
}

export interface ToastEntityRef {
  guid: string;
  entityType?: string;
  externalId?: string;
}

export interface ToastOrder {
  guid: string;
  entityType: string;
  externalId?: string;
  revenueCenter?: ToastEntityRef;
  server?: ToastEntityRef;
  diningOption?: ToastEntityRef;
  openedDate?: string;
  modifiedDate?: string;
  createdDate?: string;
  paidDate?: string;
  closedDate?: string;
  deletedDate?: string;
  voidDate?: string;
  businessDate: number; // yyyymmdd
  checks?: ToastCheck[];
  approvalStatus?: string;
  numberOfGuests?: number;
  duration?: number;
  tabName?: string;
  voided?: boolean;
  deleted?: boolean;
}

export interface ToastCheck {
  guid: string;
  entityType: string;
  displayNumber?: string;
  paymentStatus?: string; // OPEN, PAID, CLOSED
  amount?: number;
  taxAmount?: number;
  totalAmount?: number;
  tipAmount?: number;
  selections?: ToastSelection[];
  payments?: ToastPayment[];
  appliedDiscounts?: ToastDiscount[];
  customer?: ToastCustomer;
  openedDate?: string;
  closedDate?: string;
  paidDate?: string;
  voidDate?: string;
  deletedDate?: string;
  deleted?: boolean;
  voided?: boolean;
}

export interface ToastSelection {
  guid: string;
  entityType: string;
  displayName?: string;
  itemGroup?: ToastEntityRef;
  item?: ToastEntityRef;
  salesCategory?: ToastEntityRef;
  receiptLinePrice?: number;
  preDiscountPrice?: number;
  price?: number;
  tax?: number;
  quantity?: number;
  fulfillmentStatus?: string;
  createdDate?: string;
  modifiedDate?: string;
  voided?: boolean;
  deferred?: boolean;
  appliedDiscounts?: ToastDiscount[];
  appliedTaxes?: ToastAppliedTax[];
  modifiers?: ToastSelection[];
}

export interface ToastPayment {
  guid: string;
  entityType: string;
  type?: string;
  amount?: number;
  tipAmount?: number;
  amountTendered?: number;
  paymentStatus?: string;
  refundStatus?: string; // NONE, PARTIAL, FULL
  cashDrawer?: ToastEntityRef;
  originalProcessingFee?: number;
  server?: ToastEntityRef;
  voidInfo?: {
    voidDate?: string;
    voidUser?: ToastEntityRef;
    voidApprover?: ToastEntityRef;
    voidReason?: ToastEntityRef;
  };
}

export interface ToastDiscount {
  guid?: string;
  entityType?: string;
  name?: string;
  discountAmount?: number;
  discountPercent?: number;
  nonTaxDiscountAmount?: number;
  discount?: ToastEntityRef;
  approver?: ToastEntityRef;
}

export interface ToastAppliedTax {
  guid: string;
  entityType: string;
  taxRate?: ToastEntityRef;
  name?: string;
  rate?: number;
  taxAmount?: number;
}

export interface ToastCustomer {
  guid?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface ToastTimeEntry {
  guid: string;
  employeeReference?: ToastEntityRef;
  jobReference?: ToastEntityRef;
  shiftReference?: ToastEntityRef;
  inDate?: string;
  outDate?: string;
  regularHours?: number;
  overtimeHours?: number;
  cashSales?: number;
  nonCashSales?: number;
  cashGratuityServiceCharges?: number;
  nonCashGratuityServiceCharges?: number;
  declaredCashTips?: number;
  tipsWithheld?: number;
  breaks?: ToastBreak[];
  businessDate?: number;
}

export interface ToastBreak {
  guid: string;
  breakType?: ToastEntityRef;
  paid?: boolean;
  inDate?: string;
  outDate?: string;
  missed?: boolean;
}

export interface ToastEmployee {
  guid: string;
  entityType: string;
  externalEmployeeId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  deleted?: boolean;
  jobs?: ToastEmployeeJob[];
  createdDate?: string;
  modifiedDate?: string;
  deletedDate?: string;
}

export interface ToastEmployeeJob {
  guid: string;
  entityType: string;
  title?: string;
  wageType?: string;
  wageAmount?: number;
}

export interface ToastMenuItem {
  guid: string;
  name?: string;
  salesCategory?: ToastEntityRef;
  plu?: string;
  sku?: string;
  visibility?: string[];
}

export interface ToastMenu {
  guid: string;
  name?: string;
  groups?: ToastMenuGroup[];
}

export interface ToastMenuGroup {
  guid: string;
  name?: string;
  items?: ToastMenuItem[];
  subgroups?: ToastMenuGroup[];
}

export interface ToastSalesCategory {
  guid: string;
  entityType: string;
  name?: string;
}

export interface ToastRevenueCenter {
  guid: string;
  entityType: string;
  name?: string;
}

export interface ToastDiningOption {
  guid: string;
  entityType: string;
  name?: string;
  behavior?: string;
}

export interface ToastRestaurantInfo {
  guid: string;
  general?: {
    name?: string;
    locationName?: string;
    locationCode?: string;
    timeZone?: string;
    closeoutHour?: number;
    managementGroupGuid?: string;
  };
  location?: {
    address1?: string;
    address2?: string;
    city?: string;
    stateCode?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
  };
}
