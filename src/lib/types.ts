export type Role = "admin" | "seller" | "buyer";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "packing"
  | "shipping"
  | "delivered"
  | "cancelled";

export interface AppUser {
  id: string;
  tgId?: number;
  role: Role;
  fullName: string;
  phone: string;
  storeId?: string;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string;
  phone: string;
  minOrderRub: number;
  deliveryDays: number;
  rating: number;
  verified: boolean;
  logoUrl: string;
  coverUrl: string;
  categories: string[];
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  sku: string;
  category: string;
  priceRub: number;
  minQty: number;
  stock: number;
  imageUrl: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  priceRub: number;
}

export interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalRub: number;
  deliveryFeeRub: number;
  totalRub: number;
  deliveryAddress: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  meta: {
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  users: AppUser[];
  stores: Store[];
  products: Product[];
  orders: Order[];
}

export interface PublicUser {
  id: string;
  role: Role;
  fullName: string;
  phone: string;
  storeId?: string;
}

export interface BuyerData {
  stores: Store[];
  products: Product[];
  orders: Order[];
}

export interface SellerData {
  store: Store | null;
  products: Product[];
  orders: Order[];
}

export interface AdminMetrics {
  totalRevenueRub: number;
  totalOrders: number;
  activeStores: number;
  sellers: number;
  buyers: number;
}

export interface AdminData {
  stores: Store[];
  products: Product[];
  orders: Order[];
  users: PublicUser[];
  metrics: AdminMetrics;
}

export interface BootstrapPayload {
  authenticated: boolean;
  appName: string;
  user?: PublicUser;
  buyerData?: BuyerData;
  sellerData?: SellerData;
  adminData?: AdminData;
}
