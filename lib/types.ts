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
