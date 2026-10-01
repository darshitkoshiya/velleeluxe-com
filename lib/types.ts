/**
 * Shared TypeScript types for the whole Vellee Luxe codebase.
 */

export type ProductStatus = 'draft' | 'live' | 'archived';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sizes: string[];
  style: string;
  colour: string;
  fit: string;
  driveFolderId: string;
  images: string[];
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
  stock: number | 'unlimited';
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
}

export type PaymentMethod = 'razorpay' | 'cod';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Address {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
  /** First product image, stored so order history can show a thumbnail. */
  image?: string;
  slug?: string;
}

export interface Order {
  orderId: string;
  /** Firebase user ID, or "guest" for guest checkout. */
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Address;
  items: OrderItem[];
  subtotal: number;
  /** Delivery charge in INR (0 when free shipping applies). */
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  /** Set from the admin panel when the order is marked as shipped. */
  shippingInfo?: ShippingInfo;
}

export interface ShippingInfo {
  courier?: string;
  trackingNumber?: string;
  shippedAt: string;
}

/* ------------------------------------------------------------------ */
/* Returns, exchanges & store credit                                   */
/* COD: exchange or store credit only. Prepaid: Razorpay refund in rare cases. */
/* ------------------------------------------------------------------ */

/**
 * - size_exchange: size doesn't fit; customer picked an in-stock size (no admin decision needed)
 * - store_credit: size doesn't fit and the wanted size is unavailable; credit after inspection
 * - damage_defect: damaged, defective or wrong item; photos are AI-checked, admin picks the outcome
 */
export type ReturnType = 'size_exchange' | 'store_credit' | 'damage_defect';

/** What the customer chose on "Why are you returning this?". */
export type ReturnReason = 'size_doesnt_fit' | 'wrong_item' | 'damaged_defective';

/**
 * Normal flow: requested -> pickup_scheduled -> received -> inspecting -> resolved.
 * - pending_review: photo check was inconclusive; waiting for the admin to approve or reject
 * - rejected: photo check (or the admin) rejected the request
 */
export type ReturnStatus =
  | 'pending_review'
  | 'requested'
  | 'pickup_scheduled'
  | 'received'
  | 'inspecting'
  | 'resolved'
  | 'rejected';

/**
 * Outcome for damage_defect requests:
 * - exchange: same-size replacement (COD and prepaid)
 * - store_credit: credit added to the customer's account (COD and prepaid)
 * - razorpay_refund: refund to the original payment via the Razorpay API (prepaid orders only, never COD)
 */
export type ReturnDecision = 'exchange' | 'store_credit' | 'razorpay_refund';

/** Result of the automatic (Gemini Vision) photo check on damage/defect requests. */
export interface ReturnPhotoVerification {
  verdict: 'approved' | 'rejected' | 'review';
  /** Short explanation, shown to the admin (and to the customer when rejected). */
  reason: string;
  showsShirt?: boolean;
  showsDamageOrDefect?: boolean;
  /** Which reference image the photo matched: the current order's item, an older order's item, or none. */
  match?: 'current' | 'older' | 'none' | 'uncertain';
  /** Order ID of the older order the photo matched (when match === 'older'). */
  matchedOrderId?: string;
  confidence?: number;
  model?: string;
  checkedAt: string;
}

export interface ReturnRequest {
  returnId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  /** Position of the item in Order.items (used to stop duplicate requests for the same line). */
  itemIndex: number;
  itemProductId: string;
  itemProductName: string;
  /** Size the customer originally received. */
  itemSize: string;
  itemImage: string;
  itemPrice: number;
  type: ReturnType;
  reason: ReturnReason;
  /** For size_exchange: the size the customer wants instead. */
  requestedSize?: string;
  /** For damage_defect: photo URLs (base64 data URLs until Firebase Storage is set up). */
  damagePhotos?: string[];
  /** Customer's own words (issue description or extra notes). */
  description?: string;
  /** Automatic photo check result (damage_defect only). */
  verification?: ReturnPhotoVerification;
  paymentMethod: PaymentMethod;
  status: ReturnStatus;
  adminDecision?: ReturnDecision;
  resolutionNote?: string;
  /** Set by the server from Razorpay's refund response (razorpay_refund only). */
  razorpayRefundId?: string;
  /** Refunded amount in INR (razorpay_refund only). */
  refundAmount?: number;
  refundedAt?: string;
  /** Lock while a Razorpay refund call is in flight (prevents double refunds). */
  refundStartedAt?: string;
  storeCreditAmount?: number;
  /** Set once store credit has been added to the customer's balance (prevents double credit). */
  storeCreditIssuedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type StoreCreditEntryType = 'credit' | 'debit';

/** One line of the store credit ledger. `amount` is always positive; `type` says which way it moved. */
export interface StoreCreditTransaction {
  id: string;
  type: StoreCreditEntryType;
  amount: number;
  /** Mandatory, never empty — e.g. "Return approved — Order VL-123", "Applied to Order VL-456". */
  reason: string;
  orderId?: string;
  returnId?: string;
  createdAt: string;
  createdBy: 'system' | 'admin';
}

/** Stored at users/{uid}/storeCredit/summary. Store credit never expires. */
export interface StoreCredit {
  balance: number;
  transactions: StoreCreditTransaction[];
  updatedAt?: string;
}

export interface CreateReturnRequest {
  orderId: string;
  itemIndex: number;
  type: ReturnType;
  reason: ReturnReason;
  requestedSize?: string;
  damagePhotoUrls?: string[];
  description?: string;
}

/* ------------------------------------------------------------------ */
/* API request / response shapes                                       */
/* ------------------------------------------------------------------ */

/** What the browser sends for each cart line. Prices are looked up on the server. */
export interface OrderRequestItem {
  productId: string;
  size: string;
  quantity: number;
}

export interface CreateOrderRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Address;
  items: OrderRequestItem[];
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface CreateOrderResponse {
  order: Order;
}

export interface CreatePaymentResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

export interface TrackingInfo {
  courier: string;
  trackingNumber: string;
  url?: string;
}
