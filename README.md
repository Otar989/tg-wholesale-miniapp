# ОптМаркет РФ — Telegram Mini App

Полноценный mini app маркетплейса для:
- покупателей (поиск поставщиков, ассортимент, корзина, заказы),
- магазинов/поставщиков (управление товарами, статусы заказов),
- владельца/админа (роли, магазины, общий контроль заказов и метрик).

## Стек
- Next.js (App Router, TypeScript)
- API routes в том же приложении
- JSON storage (`/data/miniapp-db.json`) для MVP
- Telegram WebApp авторизация (`initData` + серверная проверка подписи)

## Запуск локально

```bash
cd /Users/otaradzhiashvili/Desktop/tg-wholesale-miniapp
npm install
npm run dev -- --port 8081
```

Открыть: [http://localhost:8081](http://localhost:8081)

## Демо-доступ
Если открываете не из Telegram, на стартовом экране доступны роли:
- `Покупатель`
- `Магазин`
- `Админ`

Это позволяет сразу тестировать весь CJ без Bot API.

## Переменные окружения (для входа через Telegram)
Создайте файл `.env.local`:

```env
TELEGRAM_BOT_TOKEN=ваш_токен_бота
SESSION_SECRET=длинный_случайный_секрет_минимум_32_символа
```

Без `TELEGRAM_BOT_TOKEN` Telegram-авторизация работать не будет, но демо-режим останется.

## Что нужно сделать на вашей стороне (пошагово)
1. В `@BotFather` создайте бота: `/newbot`.
2. Возьмите токен и добавьте в `.env.local` как `TELEGRAM_BOT_TOKEN`.
3. Разверните mini app на HTTPS-домене (Vercel подойдёт).
4. В `@BotFather` настройте кнопку mini app (Menu Button с `Web App URL`).
5. Откройте вашего бота в Telegram и нажмите кнопку mini app.
6. Для роли админа/магазина создайте нужных пользователей через админку (в демо), затем пропишите `tgId` пользователя.
7. Для прод-режима смените storage на PostgreSQL и добавьте платежи/уведомления.

## API (основное)
- `GET /api/bootstrap`
- `POST /api/auth/demo-login`
- `POST /api/auth/telegram`
- `POST /api/auth/logout`
- `POST /api/orders/checkout`
- `PATCH /api/orders/:orderId/status`
- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`
- `POST /api/admin/stores`
- `POST /api/admin/users`

## Требования Telegram
Сводка и карта соответствия в файле:

- `/Users/otaradzhiashvili/Desktop/tg-wholesale-miniapp/docs/telegram-requirements.md`
