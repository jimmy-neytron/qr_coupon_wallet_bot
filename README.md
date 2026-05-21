# QR Coupon Wallet — Telegram Mini App

Версия v8: исправлена офлайн-синхронизация после частичного успеха и ошибка IndexedDB `The object can not be cloned` при работе с группами.

Мини-приложение для Telegram, где можно хранить QR-купоны и текстовые промокоды лично или в общем пространстве с другим Telegram-пользователем.

## Проверка проекта

Перед запуском в Telegram можно проверить фронтенд локально:

```bash
npm install
npm run test
npm run build
npm run dev
```

В этой версии добавлены тесты для offline-режима:

- локальная IndexedDB-база;
- сохранение пользователя, коллекций, групп и промокодов;
- изоляция данных по коллекциям;
- очередь синхронизации;
- генерация локальных id;
- сохранение Vue reactive/proxy-объектов в IndexedDB без `DataCloneError`;
- обработка 409-конфликтов при повторной синхронизации уже созданных локально групп/купонов.

Если Vite пишет, что не найден `../services/offlineDb`, проверь, что в проекте есть файл:

```txt
src/services/offlineDb.ts
```

В этом архиве файл включён и используется в `src/stores/app.store.ts`.



## Что исправлено в v8

- Сообщение `Не удалось подключиться к серверу. Показываю локальную копию` больше не показывается как красная ошибка после частично успешной синхронизации. Теперь проблемы обновления сервера отображаются в синхронизационном баннере, а не как критический toast.
- Если локально созданный промокод уже успел сохраниться в Supabase, но операция осталась в очереди, повторный `409 Coupon already exists` корректно считается успешной синхронизацией: локальный id заменяется серверным, операция удаляется из очереди.
- Аналогично для локально созданной группы: если группа уже есть на сервере, приложение привязывает локальную группу к серверной и очищает очередь.
- IndexedDB теперь сохраняет plain-копии объектов, поэтому Vue Proxy больше не вызывает ошибку `The object can not be cloned` при удалении/обновлении групп и купонов.

## Что уже есть

- Vue 3 + Vite + TypeScript.
- Pinia store.
- Telegram Mini App интеграция через `window.Telegram.WebApp`.
- Сканирование QR через Telegram `showScanQrPopup`.
- Fallback для локальной разработки в браузере: ручной ввод строки.
- Генерация QR-кода из сохранённой строки.
- Личные и общие пространства.
- Приглашение в общее пространство по коду.
- Группы купонов: «Магнит», «Золотое яблоко», «Без группы» и т.д.
- Текстовые промокоды и QR-купоны.
- Избранное, архив, срок действия, заметки.
- Проверка дублей внутри одного пространства.
- Supabase SQL migration.
- Supabase Edge Function API с проверкой Telegram `initData`.
- Обновлённый продуктовый UI: dashboard, карточки статистики, аккуратные модальные окна и мобильный FAB.
- Защита от сворачивания Telegram Mini App при вертикальных свайпах: `disableVerticalSwipes()` + внутренний scroll-контейнер.

## Структура

```txt
qr-coupon-wallet/
├─ src/
│  ├─ components/
│  ├─ composables/
│  ├─ stores/
│  ├─ styles/
│  ├─ types/
│  ├─ utils/
│  ├─ App.vue
│  └─ main.ts
├─ supabase/
│  ├─ functions/
│  │  └─ api/
│  │     ├─ index.ts
│  │     ├─ deno.json
│  │     └─ .env.example
│  ├─ migrations/
│  │  └─ 202605210001_init.sql
│  └─ config.toml
├─ .env.example
├─ package.json
└─ README.md
```

## Быстрый запуск фронтенда

```bash
npm install
cp .env.example .env.local
npm run dev
```

По умолчанию фронт ждёт API здесь:

```bash
VITE_API_URL=http://127.0.0.1:54321/functions/v1/api
```

В браузере Telegram QR-сканер недоступен, поэтому приложение предложит вставить строку вручную. Внутри Telegram будет использоваться нативный сканер.

## Локальный запуск Supabase

Нужен Supabase CLI.

```bash
supabase start
supabase db reset
```

После `supabase start` скопируй `service_role key` из вывода команды и создай env-файл для функции:

```bash
cp supabase/functions/api/.env.example supabase/functions/api/.env.local
```

Пример `supabase/functions/api/.env.local`:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=86400
ALLOW_DEV_AUTH=true
```

Запусти Edge Function:

```bash
supabase functions serve api --env-file supabase/functions/api/.env.local
```

Для локальной разработки без Telegram в `.env.local` фронтенда уже есть:

```env
VITE_DEV_TELEGRAM_USER={"id":100001,"first_name":"Dev","last_name":"User","username":"dev_user"}
```

Edge Function принимает этот заголовок только при:

```env
ALLOW_DEV_AUTH=true
```

На production обязательно поставь:

```env
ALLOW_DEV_AUTH=false
```

## Деплой Supabase

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABCDEF
supabase secrets set TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=86400
supabase secrets set ALLOW_DEV_AUTH=false
supabase functions deploy api
```

В `supabase/config.toml` уже указано:

```toml
[functions.api]
verify_jwt = false
```

Это нужно, потому что авторизация идёт не через Supabase Auth JWT, а через Telegram `initData`, который проверяется внутри функции.

## Поведение скролла в Telegram

В `src/composables/useTelegram.ts` приложение вызывает:

```ts
WebApp.disableVerticalSwipes?.()
```

Метод доступен в Telegram Mini Apps с Bot API 7.7. Дополнительно основной контейнер `.app-shell` сделан внутренним scroll-контейнером с `height: 100dvh`, `overflow-y: auto` и `overscroll-behavior-y: contain`, чтобы вертикальный скролл не провоцировал сворачивание Mini App.

## Переменные фронтенда для production

```env
VITE_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
```

После этого фронт можно задеплоить на Vercel, Netlify, Cloudflare Pages или любой статический хостинг.

## Настройка Telegram Mini App

1. Создай бота через BotFather.
2. Получи bot token.
3. Укажи этот token в `TELEGRAM_BOT_TOKEN` для Supabase Edge Function.
4. Задеплой фронтенд на HTTPS-домен.
5. В BotFather настрой Mini App URL на домен фронтенда.
6. Открой Mini App из Telegram.

## API

Все запросы должны отправлять заголовок:

```txt
X-Telegram-Init-Data: window.Telegram.WebApp.initData
```

В dev-режиме можно отправлять:

```txt
X-Dev-Telegram-User: {"id":100001,"first_name":"Dev"}
```

### Пользователь

```txt
GET /me
```

При первом входе автоматически создаются:

- `app_user`
- личное пространство `Мои купоны`
- участник пространства с ролью `owner`

### Пространства

```txt
GET /spaces
POST /spaces
PATCH /spaces/:id
DELETE /spaces/:id
GET /spaces/:spaceId/members
POST /spaces/:spaceId/invites
DELETE /spaces/:spaceId/members/:userId
POST /invites/accept
```

### Группы

```txt
GET /spaces/:spaceId/groups
POST /spaces/:spaceId/groups
PATCH /groups/:id
DELETE /groups/:id
```

### Купоны

```txt
GET /spaces/:spaceId/coupons
POST /spaces/:spaceId/coupons
PATCH /coupons/:id
DELETE /coupons/:id
```

Поддерживаемые query-параметры:

```txt
archived=true | false
group_id=<uuid> | null
favorite=true
search=<text>
```

## Важное ограничение

Приложение сохраняет строку из QR и потом генерирует QR из этой же строки. Это работает для статичных QR-кодов и обычных промокодов.

Если магазин использует одноразовый, динамический или серверно привязанный QR-код, повторно сгенерированный QR может не пройти проверку на кассе.

## Что можно улучшить потом

- История действий: кто добавил/изменил/удалил купон.
- Роль `viewer`, чтобы участник мог только смотреть купоны.
- Realtime-обновления между двумя пользователями.
- Импорт/экспорт JSON.
- Уведомления о скором окончании срока действия.
- Брендовые иконки групп.
## UI v3

В этой версии главный экран сфокусирован только на промокодах: сканирование QR, ручное добавление, поиск, быстрые фильтры и список купонов. Управление пространствами, приглашения и участники вынесены во вкладку «Профиль». Внизу добавлена удобная навигация: «Промо», «Группы», «Профиль».


## Offline-first режим

В версии `v6-offline` добавлен локальный режим работы:

- приложение кеширует интерфейс через `public/sw.js`;
- промокоды, группы, коллекции и участники сохраняются локально в IndexedDB;
- при отсутствии интернета показывается последняя сохранённая локальная копия;
- QR-коды можно открывать и генерировать из локальных данных;
- новые промокоды и группы можно добавлять офлайн;
- редактирование, избранное, архив и удаление промокодов работают локально;
- изменения складываются в очередь синхронизации;
- когда интернет возвращается, очередь автоматически отправляется в Supabase.

Ограничения офлайн-режима:

- первый запуск всё равно должен быть онлайн, чтобы приложение получило данные и сохранило локальную копию;
- создание общей коллекции, вход по коду и создание приглашений требуют интернет;
- данные второго пользователя появятся только после синхронизации;
- стабильность service worker зависит от платформы и Telegram WebView, поэтому основная локальная копия хранится именно в IndexedDB.

Для проверки офлайн-режима:

1. Запусти приложение онлайн и дождись загрузки купонов.
2. Добавь один промокод.
3. Отключи интернет или включи offline в DevTools.
4. Обнови страницу: приложение должно показать локальную копию.
5. Добавь промокод офлайн — появится бейдж с количеством изменений в очереди.
6. Верни интернет — изменения синхронизируются с Supabase.

## v9: структура, роуты, тосты и offline fallback

В этой версии фронтенд разделён на полноценные маршруты:

- `/` — главный экран промокодов;
- `/groups` — категории/группы;
- `/profile` — коллекции, приглашения и совместный доступ.

Ключевые файлы:

```txt
src/router/index.ts
src/views/HomeView.vue
src/views/GroupsView.vue
src/views/ProfileView.vue
src/components/ui/AppToastStack.vue
src/composables/walletUi.ts
src/stores/app.store.ts
```

Уведомления вынесены в `AppToastStack.vue` и показываются снизу экрана, выше нижней навигации.

Offline fallback стал мягче: если приложение считает, что интернет есть, но конкретный запрос на создание/изменение/удаление группы или промокода падает из-за сети, действие сразу сохраняется локально в IndexedDB и попадает в очередь синхронизации. Пользователь больше не должен сначала получать ошибку, чтобы только со второго раза приложение перешло в offline-режим.

Проверка:

```bash
npm run test
npm run build
```

Тесты покрывают IndexedDB-хранилище и fallback-сценарии, когда сеть пропадает во время создания группы или промокода.
