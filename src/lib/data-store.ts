import { randomUUID } from "crypto";

import { supabase } from "./supabase";
import { AppUser, Database, Order, Product, Store } from "./types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const isoNow = () => new Date().toISOString();

export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;

/* ------------------------------------------------------------------ */
/*  Row ↔ Domain mappers                                              */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToUser = (r: any): AppUser => ({
  id: r.id,
  tgId: r.tg_id ?? undefined,
  role: r.role,
  fullName: r.full_name,
  phone: r.phone ?? "",
  storeId: r.store_id ?? undefined,
  createdAt: r.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToStore = (r: any): Store => ({
  id: r.id,
  name: r.name,
  city: r.city,
  address: r.address ?? "",
  description: r.description ?? "",
  phone: r.phone ?? "",
  minOrderRub: r.min_order_rub,
  deliveryDays: r.delivery_days,
  rating: r.rating,
  verified: r.verified,
  logoUrl: r.logo_url ?? "",
  coverUrl: r.cover_url ?? "",
  categories: r.categories ?? [],
  createdAt: r.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToProduct = (r: any): Product => ({
  id: r.id,
  storeId: r.store_id,
  name: r.name,
  sku: r.sku,
  category: r.category ?? "",
  priceRub: r.price_rub,
  minQty: r.min_qty,
  stock: r.stock,
  imageUrl: r.image_url ?? "",
  description: r.description ?? "",
  tags: r.tags ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowToOrder = (r: any): Order => ({
  id: r.id,
  buyerId: r.buyer_id,
  storeId: r.store_id,
  status: r.status,
  items: r.items ?? [],
  subtotalRub: r.subtotal_rub,
  deliveryFeeRub: r.delivery_fee_rub,
  totalRub: r.total_rub,
  deliveryAddress: r.delivery_address ?? "",
  comment: r.comment ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/* ------------------------------------------------------------------ */
/*  readDb – loads all tables into a Database object                  */
/* ------------------------------------------------------------------ */

export const readDb = async (): Promise<Database> => {
  const [usersRes, storesRes, productsRes, ordersRes] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("stores").select("*"),
    supabase.from("products").select("*"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
  ]);

  if (usersRes.error) throw new Error(`users: ${usersRes.error.message}`);
  if (storesRes.error) throw new Error(`stores: ${storesRes.error.message}`);
  if (productsRes.error) throw new Error(`products: ${productsRes.error.message}`);
  if (ordersRes.error) throw new Error(`orders: ${ordersRes.error.message}`);

  return {
    meta: { version: 1, createdAt: isoNow(), updatedAt: isoNow() },
    users: (usersRes.data ?? []).map(rowToUser),
    stores: (storesRes.data ?? []).map(rowToStore),
    products: (productsRes.data ?? []).map(rowToProduct),
    orders: (ordersRes.data ?? []).map(rowToOrder),
  };
};

/* ------------------------------------------------------------------ */
/*  updateDb – snapshot → mutate → diff → apply changes               */
/* ------------------------------------------------------------------ */

let writeQueue = Promise.resolve();

export const updateDb = async <T>(
  mutator: (db: Database) => Promise<T> | T,
): Promise<T> => {
  let result!: T;

  await (writeQueue = writeQueue.then(async () => {
    const before = await readDb();
    const working = structuredClone(before);
    result = await mutator(working);

    // Diff and apply changes for each table
    await Promise.all([
      syncUsers(before.users, working.users),
      syncStores(before.stores, working.stores),
      syncProducts(before.products, working.products),
      syncOrders(before.orders, working.orders),
    ]);
  }));

  return result;
};

/* ------------------------------------------------------------------ */
/*  Sync helpers – compare before/after and push changes              */
/* ------------------------------------------------------------------ */

async function syncUsers(before: AppUser[], after: AppUser[]) {
  const beforeIds = new Set(before.map((u) => u.id));
  const afterIds = new Set(after.map((u) => u.id));

  // Inserts
  const inserts = after.filter((u) => !beforeIds.has(u.id));
  for (const u of inserts) {
    const { error } = await supabase.from("users").insert({
      id: u.id,
      tg_id: u.tgId ?? null,
      role: u.role,
      full_name: u.fullName,
      phone: u.phone || null,
      store_id: u.storeId ?? null,
      created_at: u.createdAt,
    });
    if (error) throw new Error(`Insert user: ${error.message}`);
  }

  // Updates
  for (const u of after) {
    if (!beforeIds.has(u.id)) continue;
    const old = before.find((o) => o.id === u.id)!;
    if (JSON.stringify(old) !== JSON.stringify(u)) {
      const { error } = await supabase
        .from("users")
        .update({
          tg_id: u.tgId ?? null,
          role: u.role,
          full_name: u.fullName,
          phone: u.phone || null,
          store_id: u.storeId ?? null,
        })
        .eq("id", u.id);
      if (error) throw new Error(`Update user: ${error.message}`);
    }
  }

  // Deletes
  const deletes = before.filter((u) => !afterIds.has(u.id));
  for (const u of deletes) {
    await supabase.from("users").delete().eq("id", u.id);
  }
}

async function syncStores(before: Store[], after: Store[]) {
  const beforeIds = new Set(before.map((s) => s.id));
  const afterIds = new Set(after.map((s) => s.id));

  for (const s of after) {
    if (!beforeIds.has(s.id)) {
      const { error } = await supabase.from("stores").insert({
        id: s.id,
        name: s.name,
        city: s.city,
        address: s.address,
        description: s.description,
        phone: s.phone,
        min_order_rub: s.minOrderRub,
        delivery_days: s.deliveryDays,
        rating: s.rating,
        verified: s.verified,
        logo_url: s.logoUrl,
        cover_url: s.coverUrl,
        categories: s.categories,
        created_at: s.createdAt,
      });
      if (error) throw new Error(`Insert store: ${error.message}`);
    } else {
      const old = before.find((o) => o.id === s.id)!;
      if (JSON.stringify(old) !== JSON.stringify(s)) {
        const { error } = await supabase
          .from("stores")
          .update({
            name: s.name,
            city: s.city,
            address: s.address,
            description: s.description,
            phone: s.phone,
            min_order_rub: s.minOrderRub,
            delivery_days: s.deliveryDays,
            rating: s.rating,
            verified: s.verified,
            logo_url: s.logoUrl,
            cover_url: s.coverUrl,
            categories: s.categories,
          })
          .eq("id", s.id);
        if (error) throw new Error(`Update store: ${error.message}`);
      }
    }
  }

  for (const s of before) {
    if (!afterIds.has(s.id)) {
      await supabase.from("stores").delete().eq("id", s.id);
    }
  }
}

async function syncProducts(before: Product[], after: Product[]) {
  const beforeIds = new Set(before.map((p) => p.id));
  const afterIds = new Set(after.map((p) => p.id));

  for (const p of after) {
    if (!beforeIds.has(p.id)) {
      const { error } = await supabase.from("products").insert({
        id: p.id,
        store_id: p.storeId,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price_rub: p.priceRub,
        min_qty: p.minQty,
        stock: p.stock,
        image_url: p.imageUrl,
        description: p.description,
        tags: p.tags,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      });
      if (error) throw new Error(`Insert product: ${error.message}`);
    } else {
      const old = before.find((o) => o.id === p.id)!;
      if (JSON.stringify(old) !== JSON.stringify(p)) {
        const { error } = await supabase
          .from("products")
          .update({
            name: p.name,
            sku: p.sku,
            category: p.category,
            price_rub: p.priceRub,
            min_qty: p.minQty,
            stock: p.stock,
            image_url: p.imageUrl,
            description: p.description,
            tags: p.tags,
            updated_at: p.updatedAt,
          })
          .eq("id", p.id);
        if (error) throw new Error(`Update product: ${error.message}`);
      }
    }
  }

  for (const p of before) {
    if (!afterIds.has(p.id)) {
      await supabase.from("products").delete().eq("id", p.id);
    }
  }
}

async function syncOrders(before: Order[], after: Order[]) {
  const beforeIds = new Set(before.map((o) => o.id));
  const afterIds = new Set(after.map((o) => o.id));

  for (const o of after) {
    if (!beforeIds.has(o.id)) {
      const { error } = await supabase.from("orders").insert({
        id: o.id,
        buyer_id: o.buyerId,
        store_id: o.storeId,
        status: o.status,
        items: o.items,
        subtotal_rub: o.subtotalRub,
        delivery_fee_rub: o.deliveryFeeRub,
        total_rub: o.totalRub,
        delivery_address: o.deliveryAddress,
        comment: o.comment ?? null,
        created_at: o.createdAt,
        updated_at: o.updatedAt,
      });
      if (error) throw new Error(`Insert order: ${error.message}`);
    } else {
      const old = before.find((x) => x.id === o.id)!;
      if (JSON.stringify(old) !== JSON.stringify(o)) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: o.status,
            items: o.items,
            subtotal_rub: o.subtotalRub,
            delivery_fee_rub: o.deliveryFeeRub,
            total_rub: o.totalRub,
            delivery_address: o.deliveryAddress,
            comment: o.comment ?? null,
            updated_at: o.updatedAt,
          })
          .eq("id", o.id);
        if (error) throw new Error(`Update order: ${error.message}`);
      }
    }
  }

  for (const o of before) {
    if (!afterIds.has(o.id)) {
      await supabase.from("orders").delete().eq("id", o.id);
    }
  }
}
