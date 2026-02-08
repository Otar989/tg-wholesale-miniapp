import {
  AdminData,
  AppUser,
  BootstrapPayload,
  BuyerData,
  Database,
  PublicUser,
  SellerData,
} from "./types";

const APP_NAME = "ОптМаркет РФ — Telegram Mini App";

export const toPublicUser = (user: AppUser): PublicUser => ({
  id: user.id,
  role: user.role,
  fullName: user.fullName,
  phone: user.phone,
  storeId: user.storeId,
});

const sortByDateDesc = <T extends { createdAt: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const buildBuyerData = (db: Database, user: AppUser): BuyerData => {
  const orders = sortByDateDesc(db.orders.filter((order) => order.buyerId === user.id));
  return {
    stores: db.stores,
    products: db.products,
    orders,
  };
};

const buildSellerData = (db: Database, user: AppUser): SellerData => {
  const store = db.stores.find((item) => item.id === user.storeId) ?? null;
  const products = db.products.filter((item) => item.storeId === user.storeId);
  const orders = sortByDateDesc(db.orders.filter((order) => order.storeId === user.storeId));
  return {
    store,
    products,
    orders,
  };
};

const buildAdminData = (db: Database): AdminData => {
  const totalRevenueRub = db.orders.reduce((sum, order) => sum + order.totalRub, 0);

  return {
    stores: db.stores,
    products: db.products,
    orders: sortByDateDesc(db.orders),
    users: db.users.map(toPublicUser),
    metrics: {
      totalRevenueRub,
      totalOrders: db.orders.length,
      activeStores: db.stores.length,
      sellers: db.users.filter((user) => user.role === "seller").length,
      buyers: db.users.filter((user) => user.role === "buyer").length,
    },
  };
};

export const buildBootstrap = (db: Database, user: AppUser): BootstrapPayload => {
  if (user.role === "buyer") {
    return {
      authenticated: true,
      appName: APP_NAME,
      user: toPublicUser(user),
      buyerData: buildBuyerData(db, user),
    };
  }

  if (user.role === "seller") {
    return {
      authenticated: true,
      appName: APP_NAME,
      user: toPublicUser(user),
      sellerData: buildSellerData(db, user),
    };
  }

  return {
    authenticated: true,
    appName: APP_NAME,
    user: toPublicUser(user),
    adminData: buildAdminData(db),
  };
};

export const unauthenticatedBootstrap = (): BootstrapPayload => ({
  authenticated: false,
  appName: APP_NAME,
});
