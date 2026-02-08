"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { BootstrapPayload, Order, OrderStatus, Product, Role, Store } from "@/lib/types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
          };
        };
        colorScheme?: "light" | "dark";
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

type Notice = {
  type: "ok" | "error";
  text: string;
};

type Tab = {
  id: string;
  label: string;
};

interface CartLine {
  product: Product;
  store: Store | undefined;
  qty: number;
  amountRub: number;
}

interface ProductDraft {
  name: string;
  category: string;
  priceRub: number;
  minQty: number;
  stock: number;
  imageUrl: string;
  description: string;
  tagsInput: string;
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  packing: "Комплектация",
  shipping: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const ROLE_TITLE: Record<Role, string> = {
  buyer: "Покупатель",
  seller: "Магазин",
  admin: "Админ",
};

const tabsByRole: Record<Role, Tab[]> = {
  buyer: [
    { id: "marketplace", label: "Маркетплейс" },
    { id: "cart", label: "Корзина" },
    { id: "orders", label: "Заказы" },
    { id: "profile", label: "Профиль" },
  ],
  seller: [
    { id: "dashboard", label: "Дашборд" },
    { id: "products", label: "Товары" },
    { id: "orders", label: "Заказы" },
    { id: "profile", label: "Профиль" },
  ],
  admin: [
    { id: "overview", label: "Обзор" },
    { id: "stores", label: "Магазины" },
    { id: "users", label: "Пользователи" },
    { id: "orders", label: "Заказы" },
  ],
};

const defaultBootstrap: BootstrapPayload = {
  authenticated: false,
  appName: "ОптМаркет РФ — Telegram Mini App",
};

const EMPTY_STORES: Store[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_ORDERS: Order[] = [];

const formatRub = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const toNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

const buildProductDraft = (product: Product): ProductDraft => ({
  name: product.name,
  category: product.category,
  priceRub: product.priceRub,
  minQty: product.minQty,
  stock: product.stock,
  imageUrl: product.imageUrl,
  description: product.description,
  tagsInput: product.tags.join(", "),
});

export default function Home() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(defaultBootstrap);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchText, setSearchText] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryAddress, setDeliveryAddress] = useState(
    "Москва, ул. Складочная, 14",
  );
  const [checkoutComment, setCheckoutComment] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const [authState, setAuthState] = useState<"loading" | "not-telegram" | "registering" | "authenticated">("loading");
  const [telegramUser, setTelegramUser] = useState<{id?: number; firstName?: string; lastName?: string; username?: string} | null>(null);
  const [registrationForm, setRegistrationForm] = useState({
    role: "buyer" as "buyer" | "seller",
    fullName: "",
    phone: "",
    deliveryAddress: "",
    storeData: {
      name: "",
      city: "",
      address: "",
      phone: "",
      minOrderRub: "10000",
      deliveryDays: "2",
      description: "",
    },
  });
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    category: "",
    priceRub: "0",
    minQty: "1",
    stock: "0",
    imageUrl: "",
    description: "",
    tags: "",
  });
  const [newStore, setNewStore] = useState({
    name: "",
    city: "",
    address: "",
    phone: "",
    minOrderRub: "10000",
    deliveryDays: "2",
    description: "",
  });
  const [newUser, setNewUser] = useState({
    fullName: "",
    role: "buyer" as Role,
    phone: "",
    storeId: "",
    tgId: "",
  });

  const role = bootstrap.user?.role;
  const tabs = role ? tabsByRole[role] : [];

  const buyerData = bootstrap.buyerData;
  const buyerStores = buyerData?.stores ?? EMPTY_STORES;
  const buyerProducts = buyerData?.products ?? EMPTY_PRODUCTS;
  const buyerOrders = buyerData?.orders ?? EMPTY_ORDERS;

  const sellerData = bootstrap.sellerData;
  const sellerStore = sellerData?.store ?? null;
  const sellerProducts = sellerData?.products ?? EMPTY_PRODUCTS;
  const sellerOrders = sellerData?.orders ?? EMPTY_ORDERS;

  const adminData = bootstrap.adminData;
  const adminStores = adminData?.stores ?? EMPTY_STORES;
  const adminOrders = adminData?.orders ?? EMPTY_ORDERS;
  const adminUsers = adminData?.users ?? [];

  const storeMap = useMemo(
    () => new Map(buyerStores.map((store) => [store.id, store])),
    [buyerStores],
  );

  const productMap = useMemo(
    () => new Map(buyerProducts.map((product) => [product.id, product])),
    [buyerProducts],
  );

  const filteredStores = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) {
      return buyerStores;
    }
    return buyerStores.filter((store) => {
      const haystack = [
        store.name,
        store.city,
        store.categories.join(" "),
        store.description,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [buyerStores, searchText]);

  const selectedStore = useMemo(
    () => filteredStores.find((store) => store.id === selectedStoreId) ?? filteredStores[0],
    [filteredStores, selectedStoreId],
  );

  const selectedStoreProducts = useMemo(() => {
    if (!selectedStore) {
      return [];
    }
    return buyerProducts.filter((product) => product.storeId === selectedStore.id);
  }, [buyerProducts, selectedStore]);

  const cartLines = useMemo<CartLine[]>(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = productMap.get(productId);
        if (!product) {
          return null;
        }
        return {
          product,
          store: storeMap.get(product.storeId),
          qty,
          amountRub: qty * product.priceRub,
        };
      })
      .filter(Boolean) as CartLine[];
  }, [cart, productMap, storeMap]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.amountRub, 0),
    [cartLines],
  );

  useEffect(() => {
    if (!role) {
      return;
    }
    const availableTabs = tabsByRole[role];
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (role === "buyer" && filteredStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(filteredStores[0].id);
    }
  }, [role, filteredStores, selectedStoreId]);

  useEffect(() => {
    if (role !== "seller") {
      return;
    }
    const nextDrafts: Record<string, ProductDraft> = {};
    for (const product of sellerProducts) {
      nextDrafts[product.id] = buildProductDraft(product);
    }
    setProductDrafts(nextDrafts);
  }, [role, sellerProducts]);

  const setOk = (text: string) => setNotice({ type: "ok", text });
  const setError = (text: string) => setNotice({ type: "error", text });

  const refreshBootstrap = async () => {
    const payload = await apiRequest<BootstrapPayload>(`/api/bootstrap?ts=${Date.now()}`, {
      method: "GET",
    });
    setBootstrap(payload);
    return payload;
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setAuthState("loading");
      try {
        const webApp = window.Telegram?.WebApp;

        /* Check if running inside Telegram */
        if (!webApp?.initData) {
          setAuthState("not-telegram");
          setLoading(false);
          return;
        }

        setTelegramAvailable(true);
        webApp.ready();
        webApp.expand();

        /* Check existing session first */
        const initial = await refreshBootstrap();
        if (initial.authenticated) {
          setAuthState("authenticated");
          return;
        }

        /* Try Telegram auth */
        const result = await apiRequest<{
          ok: boolean;
          registered: boolean;
          user?: { id: string; role: string; fullName: string };
          telegramUser?: { id: number; firstName?: string; lastName?: string; username?: string };
        }>("/api/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ initData: webApp.initData }),
        });

        if (result.registered) {
          /* Existing user — auto-login */
          await refreshBootstrap();
          setAuthState("authenticated");
          return;
        }

        /* New user — show registration form */
        if (result.telegramUser) {
          setTelegramUser(result.telegramUser);
          setRegistrationForm((prev) => ({
            ...prev,
            fullName:
              [result.telegramUser!.firstName, result.telegramUser!.lastName]
                .filter(Boolean)
                .join(" ") || result.telegramUser!.username || "",
          }));
        }
        setAuthState("registering");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось загрузить приложение";
        setError(message);
        setAuthState("not-telegram");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    setNotice(null);
    try {
      const webApp = window.Telegram?.WebApp;
      if (!webApp?.initData) {
        throw new Error("Telegram data not available");
      }

      const payload: Record<string, unknown> = {
        initData: webApp.initData,
        role: registrationForm.role,
        fullName: registrationForm.fullName.trim(),
        phone: registrationForm.phone.trim(),
      };

      if (registrationForm.role === "buyer" && registrationForm.deliveryAddress.trim()) {
        payload.deliveryAddress = registrationForm.deliveryAddress.trim();
      }

      if (registrationForm.role === "seller") {
        payload.storeData = {
          name: registrationForm.storeData.name.trim(),
          city: registrationForm.storeData.city.trim(),
          address: registrationForm.storeData.address.trim(),
          phone: registrationForm.storeData.phone.trim(),
          minOrderRub: Math.max(1, Number(registrationForm.storeData.minOrderRub) || 10000),
          deliveryDays: Math.max(1, Math.floor(Number(registrationForm.storeData.deliveryDays) || 2)),
          description: registrationForm.storeData.description.trim(),
        };
      }

      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const bootstrap = await refreshBootstrap();
      if (bootstrap.user) {
        setActiveTab(tabsByRole[bootstrap.user.role][0].id);
      }
      setAuthState("authenticated");
      setOk("Регистрация успешна! Добро пожаловать!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка регистрации";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const logout = async () => {
    setBusyAction(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setBootstrap(defaultBootstrap);
      setCart({});
      setOk("Сессия завершена");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка выхода";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const currentQty = prev[product.id] ?? 0;
      const nextQty = currentQty === 0 ? product.minQty : currentQty + product.minQty;
      return {
        ...prev,
        [product.id]: Math.min(nextQty, product.stock),
      };
    });
    setOk(`Добавлено в корзину: ${product.name}`);
  };

  const adjustCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[productId] ?? 0;
      const product = productMap.get(productId);
      if (!product) {
        return prev;
      }
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: Math.min(nextQty, product.stock),
      };
    });
  };

  const checkout = async () => {
    if (!cartLines.length) {
      setError("Корзина пустая");
      return;
    }
    if (!deliveryAddress.trim()) {
      setError("Укажите адрес доставки");
      return;
    }

    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: cartLines.map((line) => ({
            productId: line.product.id,
            qty: line.qty,
          })),
          deliveryAddress,
          comment: checkoutComment.trim(),
        }),
      });
      setCart({});
      setCheckoutComment("");
      await refreshBootstrap();
      setOk("Заказы созданы успешно");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось оформить заказ";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const saveSellerProduct = async (productId: string) => {
    const draft = productDrafts[productId];
    if (!draft) {
      return;
    }
    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest(`/api/seller/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          category: draft.category,
          priceRub: draft.priceRub,
          minQty: draft.minQty,
          stock: draft.stock,
          imageUrl: draft.imageUrl,
          description: draft.description,
          tags: draft.tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      await refreshBootstrap();
      setOk("Товар обновлён");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка обновления товара";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const createSellerProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!newProduct.name.trim() || !newProduct.sku.trim()) {
      setError("Укажите название и SKU товара");
      return;
    }
    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest("/api/seller/products", {
        method: "POST",
        body: JSON.stringify({
          ...newProduct,
          priceRub: toNumber(newProduct.priceRub, 1),
          minQty: Math.max(1, Math.floor(toNumber(newProduct.minQty, 1))),
          stock: Math.max(0, Math.floor(toNumber(newProduct.stock, 0))),
          tags: newProduct.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setNewProduct({
        name: "",
        sku: "",
        category: "",
        priceRub: "0",
        minQty: "1",
        stock: "0",
        imageUrl: "",
        description: "",
        tags: "",
      });
      await refreshBootstrap();
      setOk("Новый товар добавлен");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка создания товара";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const createStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!newStore.name.trim() || !newStore.city.trim()) {
      setError("Укажите название и город магазина");
      return;
    }
    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest("/api/admin/stores", {
        method: "POST",
        body: JSON.stringify({
          ...newStore,
          minOrderRub: toNumber(newStore.minOrderRub, 1),
          deliveryDays: Math.max(1, Math.floor(toNumber(newStore.deliveryDays, 2))),
        }),
      });
      setNewStore({
        name: "",
        city: "",
        address: "",
        phone: "",
        minOrderRub: "10000",
        deliveryDays: "2",
        description: "",
      });
      await refreshBootstrap();
      setOk("Магазин добавлен");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка создания магазина";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUser.fullName.trim()) {
      setError("Укажите имя пользователя");
      return;
    }
    if (newUser.role === "seller" && !newUser.storeId) {
      setError("Для роли магазина нужно выбрать storeId");
      return;
    }
    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: newUser.fullName,
          role: newUser.role,
          phone: newUser.phone,
          storeId: newUser.role === "seller" ? newUser.storeId : undefined,
          tgId: newUser.tgId ? Number(newUser.tgId) : undefined,
        }),
      });
      setNewUser({
        fullName: "",
        role: "buyer",
        phone: "",
        storeId: "",
        tgId: "",
      });
      await refreshBootstrap();
      setOk("Пользователь создан");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка создания пользователя";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setBusyAction(true);
    setNotice(null);
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshBootstrap();
      setOk("Статус заказа обновлён");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка обновления статуса";
      setError(message);
    } finally {
      setBusyAction(false);
    }
  };

  const renderAuth = () => {
    if (authState === "loading") {
      return (
        <div className="auth">
          <div className="auth-top">
            <h1 className="hero-title">ОптМаркет РФ</h1>
            <p className="hero-subtitle">Проверяем вашу учётную запись...</p>
          </div>
        </div>
      );
    }

    if (authState === "not-telegram") {
      return (
        <div className="auth">
          <div className="auth-top">
            <h1 className="hero-title">ОптМаркет РФ</h1>
            <p className="hero-subtitle">
              Это приложение работает только внутри Telegram.
            </p>
            <p className="hero-subtitle">
              Откройте бот @marketmall_robot в Telegram и нажмите кнопку «ОптМаркет» внизу чата.
            </p>
          </div>
        </div>
      );
    }

    /* Registration form */
    return (
      <div className="auth">
        <div className="auth-top">
          <h1 className="hero-title">ОптМаркет РФ</h1>
          <p className="hero-subtitle">
            B2B‑маркетплейс оптовых товаров. Зарегистрируйтесь, чтобы начать.
          </p>
        </div>
        <div style={{ padding: "20px" }}>
          <h3 style={{ marginTop: 0 }}>Регистрация</h3>
          <form onSubmit={handleRegister}>
            <div className="auth-grid" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${registrationForm.role === "buyer" ? "btn-primary" : "btn-light"}`}
                onClick={() => setRegistrationForm((p) => ({ ...p, role: "buyer" }))}
              >
                Я покупатель
              </button>
              <button
                type="button"
                className={`btn ${registrationForm.role === "seller" ? "btn-primary" : "btn-light"}`}
                onClick={() => setRegistrationForm((p) => ({ ...p, role: "seller" }))}
              >
                Я хочу продавать
              </button>
            </div>

            <input
              className="field"
              placeholder="Ваше имя"
              value={registrationForm.fullName}
              onChange={(e) => setRegistrationForm((p) => ({ ...p, fullName: e.target.value }))}
              disabled={busyAction}
              required
            />
            <input
              className="field"
              placeholder="Телефон"
              type="tel"
              value={registrationForm.phone}
              onChange={(e) => setRegistrationForm((p) => ({ ...p, phone: e.target.value }))}
              disabled={busyAction}
              required
              style={{ marginTop: 10 }}
            />

            {registrationForm.role === "buyer" && (
              <input
                className="field"
                placeholder="Адрес доставки (можно указать позже)"
                value={registrationForm.deliveryAddress}
                onChange={(e) => setRegistrationForm((p) => ({ ...p, deliveryAddress: e.target.value }))}
                disabled={busyAction}
                style={{ marginTop: 10 }}
              />
            )}

            {registrationForm.role === "seller" && (
              <>
                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <strong>Данные магазина</strong>
                </div>
                <input
                  className="field"
                  placeholder="Название магазина *"
                  value={registrationForm.storeData.name}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      storeData: { ...p.storeData, name: e.target.value },
                    }))
                  }
                  disabled={busyAction}
                  required
                />
                <input
                  className="field"
                  placeholder="Город *"
                  value={registrationForm.storeData.city}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      storeData: { ...p.storeData, city: e.target.value },
                    }))
                  }
                  disabled={busyAction}
                  required
                  style={{ marginTop: 10 }}
                />
                <input
                  className="field"
                  placeholder="Адрес склада / офиса"
                  value={registrationForm.storeData.address}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      storeData: { ...p.storeData, address: e.target.value },
                    }))
                  }
                  disabled={busyAction}
                  style={{ marginTop: 10 }}
                />
                <input
                  className="field"
                  placeholder="Телефон магазина"
                  type="tel"
                  value={registrationForm.storeData.phone}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      storeData: { ...p.storeData, phone: e.target.value },
                    }))
                  }
                  disabled={busyAction}
                  style={{ marginTop: 10 }}
                />
                <div className="row" style={{ marginTop: 10 }}>
                  <input
                    className="field grow"
                    placeholder="Мин. заказ (руб)"
                    type="number"
                    value={registrationForm.storeData.minOrderRub}
                    onChange={(e) =>
                      setRegistrationForm((p) => ({
                        ...p,
                        storeData: { ...p.storeData, minOrderRub: e.target.value },
                      }))
                    }
                    disabled={busyAction}
                  />
                  <input
                    className="field grow"
                    placeholder="Дни доставки"
                    type="number"
                    value={registrationForm.storeData.deliveryDays}
                    onChange={(e) =>
                      setRegistrationForm((p) => ({
                        ...p,
                        storeData: { ...p.storeData, deliveryDays: e.target.value },
                      }))
                    }
                    disabled={busyAction}
                  />
                </div>
                <textarea
                  className="field"
                  placeholder="Описание магазина"
                  value={registrationForm.storeData.description}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      storeData: { ...p.storeData, description: e.target.value },
                    }))
                  }
                  disabled={busyAction}
                  style={{ marginTop: 10 }}
                />
              </>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={busyAction}
              style={{ marginTop: 16, width: "100%" }}
            >
              {busyAction
                ? "Регистрация..."
                : registrationForm.role === "buyer"
                  ? "Начать покупки"
                  : "Открыть магазин"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (authState !== "authenticated" || !bootstrap.authenticated || !role || !bootstrap.user) {
    return (
      <>
        {renderAuth()}
        {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}
      </>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-header">
          <div>
            <h1 className="hero-title">{bootstrap.appName}</h1>
            <p className="hero-subtitle">
              Роль: <strong>{ROLE_TITLE[role]}</strong> · Пользователь:{" "}
              <strong>{bootstrap.user.fullName}</strong>
            </p>
          </div>
          <button className="btn btn-light" onClick={logout} disabled={busyAction}>
            Выйти
          </button>
        </div>
        <div className="pill-row">
          <span className="pill">Telegram-ready</span>
          <span className="pill">Высокий UX</span>
          <span className="pill">Ролевой доступ</span>
        </div>
      </section>

      {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}

      <section className="layout">
        <aside className="sidebar">
          <div className="side-role">
            <span className="role-dot" />
            <div>
              <div style={{ fontWeight: 700 }}>{ROLE_TITLE[role]}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {bootstrap.user.fullName}
              </div>
            </div>
          </div>
          <nav className="side-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="side-footer">Версия: MVP Telegram Mini App</div>
        </aside>

        <section className="content">
          {role === "buyer" && activeTab === "marketplace" ? (
            <div className="panel">
              <h2 className="panel-title">Поставщики и ассортимент</h2>
              <div className="row">
                <div className="grow">
                  <input
                    className="search-input"
                    placeholder="Поиск поставщика, категории, города..."
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </div>
              </div>
              <div className="store-grid" style={{ marginTop: 12 }}>
                <div className="store-list">
                  {filteredStores.map((store) => (
                    <article
                      key={store.id}
                      className={`store-card ${selectedStore?.id === store.id ? "active" : ""}`}
                      onClick={() => setSelectedStoreId(store.id)}
                    >
                      <h3 className="store-card-title">{store.name}</h3>
                      <p className="store-card-meta">
                        {store.city} · Рейтинг {store.rating} · Мин. заказ {formatRub(store.minOrderRub)}
                      </p>
                      <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
                        {store.description}
                      </p>
                    </article>
                  ))}
                  {!filteredStores.length ? (
                    <div className="empty">Поставщики не найдены.</div>
                  ) : null}
                </div>

                {selectedStore ? (
                  <div className="store-showcase">
                    <img src={selectedStore.coverUrl} alt={selectedStore.name} className="store-cover" />
                    <div className="store-head">
                      <h3 className="store-head-title">{selectedStore.name}</h3>
                      <p className="muted" style={{ margin: "6px 0 0" }}>
                        {selectedStore.address} · Доставка {selectedStore.deliveryDays} дн.
                      </p>
                      <div className="chip-row">
                        {selectedStore.categories.map((category) => (
                          <span key={category} className="chip">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="product-grid">
                      {selectedStoreProducts.map((product) => (
                        <article key={product.id} className="product-card">
                          <img src={product.imageUrl} alt={product.name} className="product-image" />
                          <div className="product-body">
                            <h4 className="product-title">{product.name}</h4>
                            <p className="product-meta">
                              SKU: {product.sku} · мин. {product.minQty} шт · остаток {product.stock}
                            </p>
                            <div className="price-row">
                              <p className="price">{formatRub(product.priceRub)}</p>
                              <button
                                className="btn btn-primary"
                                onClick={() => addToCart(product)}
                                disabled={busyAction}
                              >
                                + В корзину
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty">Выберите поставщика слева.</div>
                )}
              </div>
            </div>
          ) : null}

          {role === "buyer" && activeTab === "cart" ? (
            <div className="panel">
              <h2 className="panel-title">Корзина покупателя</h2>
              {!cartLines.length ? (
                <div className="empty">Корзина пока пустая.</div>
              ) : (
                <>
                  {cartLines.map((line) => (
                    <article key={line.product.id} className="cart-row">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{line.product.name}</div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {line.store?.name ?? "Магазин"} · {formatRub(line.product.priceRub)} / шт
                          </div>
                        </div>
                        <div className="qty">
                          <button onClick={() => adjustCartQty(line.product.id, -1)}>-</button>
                          <strong>{line.qty}</strong>
                          <button onClick={() => adjustCartQty(line.product.id, 1)}>+</button>
                        </div>
                        <strong>{formatRub(line.amountRub)}</strong>
                      </div>
                    </article>
                  ))}

                  <div className="panel" style={{ background: "#fbfcff", marginTop: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Оформление</h3>
                    <div className="row">
                      <div className="grow">
                        <input
                          className="field"
                          value={deliveryAddress}
                          onChange={(event) => setDeliveryAddress(event.target.value)}
                          placeholder="Адрес доставки"
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        className="field"
                        value={checkoutComment}
                        onChange={(event) => setCheckoutComment(event.target.value)}
                        placeholder="Комментарий к заказу"
                      />
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <strong>Итого: {formatRub(cartTotal)}</strong>
                      <button className="btn btn-primary" onClick={checkout} disabled={busyAction}>
                        Оформить заказ
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {role === "buyer" && activeTab === "orders" ? (
            <div className="panel">
              <h2 className="panel-title">Мои заказы</h2>
              {!buyerOrders.length ? (
                <div className="empty">Заказов пока нет.</div>
              ) : (
                <table className="table-like">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Магазин</th>
                      <th>Статус</th>
                      <th>Сумма</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyerOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>{storeMap.get(order.storeId)?.name ?? order.storeId}</td>
                        <td>
                          <span className={`status ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                        </td>
                        <td>{formatRub(order.totalRub)}</td>
                        <td>{new Date(order.createdAt).toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          {role === "buyer" && activeTab === "profile" ? (
            <div className="panel">
              <h2 className="panel-title">Профиль покупателя</h2>
              <div className="stat-grid">
                <article className="stat-card">
                  <p className="stat-label">Пользователь</p>
                  <p className="stat-value">{bootstrap.user.fullName}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Телефон</p>
                  <p className="stat-value">{bootstrap.user.phone || "Не указан"}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Заказов</p>
                  <p className="stat-value">{buyerOrders.length}</p>
                </article>
              </div>
            </div>
          ) : null}

          {role === "seller" && activeTab === "dashboard" ? (
            <div className="panel">
              <h2 className="panel-title">Дашборд магазина</h2>
              <div className="stat-grid">
                <article className="stat-card">
                  <p className="stat-label">Магазин</p>
                  <p className="stat-value">{sellerStore?.name ?? "Не привязан"}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Товаров</p>
                  <p className="stat-value">{sellerProducts.length}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Заказов</p>
                  <p className="stat-value">{sellerOrders.length}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Выручка</p>
                  <p className="stat-value">
                    {formatRub(sellerOrders.reduce((sum, order) => sum + order.totalRub, 0))}
                  </p>
                </article>
              </div>
            </div>
          ) : null}

          {role === "seller" && activeTab === "products" ? (
            <div className="panel">
              <h2 className="panel-title">Ассортимент магазина</h2>
              {!sellerProducts.length ? <div className="empty">Товаров пока нет.</div> : null}
              <div className="product-grid">
                {sellerProducts.map((product) => {
                  const draft = productDrafts[product.id];
                  if (!draft) {
                    return null;
                  }
                  return (
                    <article key={product.id} className="product-card">
                      <img src={draft.imageUrl || product.imageUrl} alt={product.name} className="product-image" />
                      <div className="product-body">
                        <input
                          className="field"
                          value={draft.name}
                          onChange={(event) =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [product.id]: { ...prev[product.id], name: event.target.value },
                            }))
                          }
                        />
                        <div className="row" style={{ marginTop: 8 }}>
                          <input
                            className="field"
                            style={{ maxWidth: 120 }}
                            type="number"
                            value={draft.priceRub}
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: {
                                  ...prev[product.id],
                                  priceRub: toNumber(event.target.value, draft.priceRub),
                                },
                              }))
                            }
                          />
                          <input
                            className="field"
                            style={{ maxWidth: 120 }}
                            type="number"
                            value={draft.minQty}
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: {
                                  ...prev[product.id],
                                  minQty: Math.max(1, Math.floor(toNumber(event.target.value, draft.minQty))),
                                },
                              }))
                            }
                          />
                          <input
                            className="field"
                            style={{ maxWidth: 120 }}
                            type="number"
                            value={draft.stock}
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: {
                                  ...prev[product.id],
                                  stock: Math.max(0, Math.floor(toNumber(event.target.value, draft.stock))),
                                },
                              }))
                            }
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <input
                            className="field"
                            value={draft.category}
                            placeholder="Категория"
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...prev[product.id], category: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <input
                            className="field"
                            value={draft.tagsInput}
                            placeholder="Теги через запятую"
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...prev[product.id], tagsInput: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <textarea
                            className="field"
                            value={draft.description}
                            placeholder="Описание"
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...prev[product.id], description: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <input
                            className="field"
                            value={draft.imageUrl}
                            placeholder="URL изображения"
                            onChange={(event) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...prev[product.id], imageUrl: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <button className="btn btn-primary" onClick={() => saveSellerProduct(product.id)}>
                            Сохранить товар
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="panel" style={{ marginTop: 16, background: "#fbfcff" }}>
                <h3 style={{ marginTop: 0 }}>Добавить новый товар</h3>
                <form onSubmit={createSellerProduct}>
                  <div className="row">
                    <input
                      className="field grow"
                      placeholder="Название"
                      value={newProduct.name}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 200 }}
                      placeholder="SKU"
                      value={newProduct.sku}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, sku: event.target.value }))
                      }
                    />
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <input
                      className="field grow"
                      placeholder="Категория"
                      value={newProduct.category}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, category: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 140 }}
                      type="number"
                      placeholder="Цена"
                      value={newProduct.priceRub}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, priceRub: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 140 }}
                      type="number"
                      placeholder="Мин. qty"
                      value={newProduct.minQty}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, minQty: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 140 }}
                      type="number"
                      placeholder="Остаток"
                      value={newProduct.stock}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, stock: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <input
                      className="field"
                      placeholder="URL изображения"
                      value={newProduct.imageUrl}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, imageUrl: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <input
                      className="field"
                      placeholder="Теги через запятую"
                      value={newProduct.tags}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, tags: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      className="field"
                      placeholder="Описание"
                      value={newProduct.description}
                      onChange={(event) =>
                        setNewProduct((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={busyAction}>
                      Добавить товар
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {role === "seller" && activeTab === "orders" ? (
            <div className="panel">
              <h2 className="panel-title">Заказы магазина</h2>
              {!sellerOrders.length ? (
                <div className="empty">Заказов нет.</div>
              ) : (
                <table className="table-like">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Позиции</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>
                          {order.items.map((item) => `${item.name} × ${item.qty}`).join(", ")}
                        </td>
                        <td>{formatRub(order.totalRub)}</td>
                        <td>
                          <span className={`status ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                        </td>
                        <td>
                          <select
                            className="field"
                            style={{ minWidth: 170 }}
                            value={order.status}
                            onChange={(event) =>
                              updateOrderStatus(order.id, event.target.value as OrderStatus)
                            }
                          >
                            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => (
                              <option value={status} key={status}>
                                {ORDER_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          {role === "seller" && activeTab === "profile" ? (
            <div className="panel">
              <h2 className="panel-title">Профиль магазина</h2>
              <div className="stat-grid">
                <article className="stat-card">
                  <p className="stat-label">Пользователь</p>
                  <p className="stat-value">{bootstrap.user.fullName}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Магазин</p>
                  <p className="stat-value">{sellerStore?.name ?? "Не привязан"}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Телефон</p>
                  <p className="stat-value">{bootstrap.user.phone || "Не указан"}</p>
                </article>
              </div>
            </div>
          ) : null}

          {role === "admin" && activeTab === "overview" ? (
            <div className="panel">
              <h2 className="panel-title">Админ‑обзор</h2>
              <div className="stat-grid">
                <article className="stat-card">
                  <p className="stat-label">Выручка</p>
                  <p className="stat-value">{formatRub(adminData?.metrics.totalRevenueRub ?? 0)}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Заказы</p>
                  <p className="stat-value">{adminData?.metrics.totalOrders ?? 0}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Магазины</p>
                  <p className="stat-value">{adminData?.metrics.activeStores ?? 0}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Пользователи</p>
                  <p className="stat-value">
                    {(adminData?.metrics.sellers ?? 0) + (adminData?.metrics.buyers ?? 0)}
                  </p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Товаров в каталоге</p>
                  <p className="stat-value">{adminData?.products.length ?? 0}</p>
                </article>
              </div>
            </div>
          ) : null}

          {role === "admin" && activeTab === "stores" ? (
            <div className="panel">
              <h2 className="panel-title">Управление магазинами</h2>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Город</th>
                    <th>Мин. заказ</th>
                    <th>Телефон</th>
                  </tr>
                </thead>
                <tbody>
                  {adminStores.map((store) => (
                    <tr key={store.id}>
                      <td>{store.id}</td>
                      <td>{store.name}</td>
                      <td>{store.city}</td>
                      <td>{formatRub(store.minOrderRub)}</td>
                      <td>{store.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="panel" style={{ marginTop: 16, background: "#fbfcff" }}>
                <h3 style={{ marginTop: 0 }}>Добавить магазин</h3>
                <form onSubmit={createStore}>
                  <div className="row">
                    <input
                      className="field grow"
                      placeholder="Название"
                      value={newStore.name}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 200 }}
                      placeholder="Город"
                      value={newStore.city}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, city: event.target.value }))
                      }
                    />
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <input
                      className="field grow"
                      placeholder="Адрес"
                      value={newStore.address}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, address: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 200 }}
                      placeholder="Телефон"
                      value={newStore.phone}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <input
                      className="field"
                      style={{ maxWidth: 200 }}
                      type="number"
                      placeholder="Мин. заказ"
                      value={newStore.minOrderRub}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, minOrderRub: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 200 }}
                      type="number"
                      placeholder="Дней доставка"
                      value={newStore.deliveryDays}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, deliveryDays: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      className="field"
                      placeholder="Описание"
                      value={newStore.description}
                      onChange={(event) =>
                        setNewStore((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={busyAction}>
                      Создать магазин
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {role === "admin" && activeTab === "users" ? (
            <div className="panel">
              <h2 className="panel-title">Пользователи и роли</h2>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Телефон</th>
                    <th>Store ID</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.fullName}</td>
                      <td>{ROLE_TITLE[user.role]}</td>
                      <td>{user.phone || "-"}</td>
                      <td>{user.storeId ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="panel" style={{ marginTop: 16, background: "#fbfcff" }}>
                <h3 style={{ marginTop: 0 }}>Создать пользователя</h3>
                <form onSubmit={createUser}>
                  <div className="row">
                    <input
                      className="field grow"
                      placeholder="ФИО"
                      value={newUser.fullName}
                      onChange={(event) =>
                        setNewUser((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                    />
                    <select
                      className="field"
                      style={{ maxWidth: 180 }}
                      value={newUser.role}
                      onChange={(event) =>
                        setNewUser((prev) => ({ ...prev, role: event.target.value as Role }))
                      }
                    >
                      <option value="buyer">Покупатель</option>
                      <option value="seller">Магазин</option>
                    </select>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <input
                      className="field"
                      style={{ maxWidth: 220 }}
                      placeholder="Телефон"
                      value={newUser.phone}
                      onChange={(event) =>
                        setNewUser((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                    <input
                      className="field"
                      style={{ maxWidth: 220 }}
                      placeholder="Telegram ID"
                      value={newUser.tgId}
                      onChange={(event) =>
                        setNewUser((prev) => ({ ...prev, tgId: event.target.value }))
                      }
                    />
                    {newUser.role === "seller" ? (
                      <select
                        className="field"
                        style={{ maxWidth: 280 }}
                        value={newUser.storeId}
                        onChange={(event) =>
                          setNewUser((prev) => ({ ...prev, storeId: event.target.value }))
                        }
                      >
                        <option value="">Выберите магазин</option>
                        {adminStores.map((store) => (
                          <option value={store.id} key={store.id}>
                            {store.name} ({store.id})
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={busyAction}>
                      Создать пользователя
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {role === "admin" && activeTab === "orders" ? (
            <div className="panel">
              <h2 className="panel-title">Все заказы системы</h2>
              {!adminOrders.length ? (
                <div className="empty">Заказов пока нет.</div>
              ) : (
                <table className="table-like">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Store ID</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Изменить</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>{order.storeId}</td>
                        <td>{formatRub(order.totalRub)}</td>
                        <td>
                          <span className={`status ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                        </td>
                        <td>
                          <select
                            className="field"
                            style={{ minWidth: 170 }}
                            value={order.status}
                            onChange={(event) =>
                              updateOrderStatus(order.id, event.target.value as OrderStatus)
                            }
                          >
                            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => (
                              <option value={status} key={status}>
                                {ORDER_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

        </section>
      </section>
    </main>
  );
}
