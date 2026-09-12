# server

Node.js/Express API on Prisma + PostgreSQL, in a routes → controllers → services layering.

```
src/
  app.js               express app: cors, json, /health, /api, notFound, errorHandler
  server.js            entry point
  config/db.js         the shared PrismaClient
  routes/              path → controller
  controllers/         request/response shape, validation
  services/            prisma queries
  middlewares/         cors, notFound, error
  utils/asyncHandler   forwards a rejected promise to the error middleware
```

## Running it

```sh
cp .env.example .env      # set DATABASE_URL
npm install
npm run prisma:migrate
npm run dev
```

## `/api/users`

`GET /api/users`, `GET /api/users/:id`, `POST /api/users` over the `User` model.

## `/api/data/:resource` -- storage for fn

The backend for the [fn](https://github.com/pariad84/fn) framework's `fn.data`, which stores
`{ id, data }` rows under a string key and expects the storage layer to be swappable. It speaks
that shape directly, so `fn.data.remote.js` is a drop-in replacement for fn's localStorage
default with no changes to any layout or app code.

| | |
|---|---|
| `GET /api/data/:resource` | all rows, `[{ id, data }]`, ordered by id |
| `GET /api/data/:resource/:id` | one row, or `404` |
| `POST /api/data/:resource` | body `{ "data": { ... } }` → `201` with the created row |
| `PUT /api/data/:resource/:id` | body `{ "data": { ... } }` → the updated row, or `404` |
| `DELETE /api/data/:resource/:id` | the deleted row, or `404` |

A malformed id or a body whose `data` is not an object answers `400`.

One `records` table serves every resource -- `resource` is the column holding fn's `key`, and
`data` is `jsonb` -- so **adding a resource is a client-side field definition, not a migration**.
The cost is that the database enforces nothing about what is inside `data`; validating a resource's
shape is the next thing worth building here.

Every lookup is scoped by `resource` as well as `id`, so an id belonging to one resource is a `404`
through another resource's URL.

### CORS

fn is a plain `<script>` page that can be served from anywhere, including `file://` (whose `Origin`
is the literal `null`), so `src/middlewares/cors.middleware.js` allows `*` by default. Set
`CORS_ORIGIN` to pin it to one origin in production.
