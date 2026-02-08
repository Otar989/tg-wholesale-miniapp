# Telegram Mini Apps — требования и как закрыто в проекте

Актуализировано: **8 февраля 2026**

## 1) Инициализация Mini App
- Требование: mini app запускается внутри Telegram WebView, данные доступны через `Telegram.WebApp`.
- Источник: [Initializing Mini Apps](https://core.telegram.org/bots/webapps#initializing-mini-apps)
- В проекте: `src/app/layout.tsx` подключает `https://telegram.org/js/telegram-web-app.js`, клиент вызывает `ready()` и `expand()`.

## 2) Проверка данных пользователя (`initData`)
- Требование: backend обязан валидировать `initData` по HMAC-схеме Telegram.
- Источник: [Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- В проекте:
  - `src/lib/telegram.ts` — проверка подписи и TTL `auth_date`.
  - `src/app/api/auth/telegram/route.ts` — серверный вход только после валидной подписи.

## 3) Запуск Mini App через кнопку бота
- Требование: использовать `web_app` в кнопке (`InlineKeyboardButton` или menu button).
- Источники:
  - [InlineKeyboardButton](https://core.telegram.org/bots/api#inlinekeyboardbutton)
  - [WebAppInfo](https://core.telegram.org/bots/api#webappinfo)
  - [ChatMenuButton](https://core.telegram.org/bots/api#chatmenubutton)
- В проекте: приложение готово к открытию по URL, дальше вы задаёте URL в `@BotFather`.

## 4) HTTPS URL для production
- Требование: `WebAppInfo.url` должен быть HTTPS (для прод окружения).
- Источник: [WebAppInfo](https://core.telegram.org/bots/api#webappinfo)
- В проекте: локально можно тестировать на `localhost`, для реального запуска нужен публичный HTTPS-домен.

## 5) Ролевой доступ
- Требование бизнеса: разделить доступ для владельца, магазина, покупателя.
- В проекте:
  - роли `admin | seller | buyer` в `src/lib/types.ts`;
  - серверные ограничения в API routes;
  - раздельные интерфейсы на клиенте (`src/app/page.tsx`).

## 6) Минимальный security baseline
- Серверные HTTP-only cookies для сессии.
- HMAC-подпись и верификация токена сессии.
- Проверка прав в каждом write-endpoint.

## Что обязательно сделать перед production
1. Перевести storage с JSON на PostgreSQL.
2. Подключить audit log на действия админа/магазина.
3. Добавить rate limit на API.
4. Добавить Webhook/уведомления по смене статуса заказа.
5. Подключить мониторинг ошибок.
