# server

Node.js/Express API on Prisma + PostgreSQL, in a routes → controllers → services layering.

```
src/
  app.js               express app: cors, json, /health, /api, notFound, errorHandler
  server.js            entry point
  config/db.js         the shared PrismaClient
  routes/              path → controller
  controllers/         request/response shape, validation
  services/            prisma queries, resource definitions
  resources/           one JSON file per resource -- the definitions themselves
  middlewares/         cors, notFound, error
  utils/asyncHandler   forwards a rejected promise to the error middleware
  utils/validateData   checks a write against its resource definition
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

A malformed id answers `400`; a resource with no definition answers `404` on every method.

One `records` table serves every resource -- `resource` is the column holding fn's `key`, and
`data` is `jsonb` -- so **adding a resource is a JSON file, not a migration**.

Every lookup is scoped by `resource` as well as `id`, so an id belonging to one resource is a `404`
through another resource's URL.

## `/api/resources` -- the definitions

`GET /api/resources` returns every definition, `GET /api/resources/:resource` one of them (or
`404`). A definition is `src/resources/<key>.json`:

```json
{
  "key": "task",
  "label": "Tasks",
  "fields": [
    { "name": "title",  "label": "Title",  "required": true, "form": { "type": "text" } },
    { "name": "status", "label": "Status", "required": true, "form": { "type": "select", "datas": [
      { "value": "todo", "label": "To do" },
      { "value": "done", "label": "Done" }
    ] } }
  ]
}
```

`fields` is exactly the array fn's `list` and `form` layouts already take, so **one definition
drives the browser's columns and inputs and this server's write validation** -- the two cannot
drift, and fn's `admin.html` renders a full CRUD console for a new resource without a line of code
changing on either side.

Since `jsonb` enforces nothing itself, that definition is the only thing standing behind the
column. `POST`/`PUT` bodies are checked against it and answer `400` listing every problem at once:

- a field the definition does not declare
- a `required` field left blank
- a `select`/`radio` value outside its `datas`
- a value that is not a single primitive
- a `number`/`range` that is not numeric, a `date`/`datetime-local` that is not a date, an `email`
  that is not one

Browsers submit every input as a string, so `number` and `checkbox` are coerced to their real
types before storage, and a blank optional field is dropped rather than stored as `""`.

### Reloading

`src/resources/` is watched, so adding, editing or removing a resource takes effect on the next
request -- no restart. Adding a resource end to end is one file: the API starts serving it, and
fn's console renders a CRUD screen for it on reload.

Boot and reload treat a bad definition differently, on purpose. At boot a malformed definition
fails the boot, rather than the first request that happens to reach it. A reload cannot do that --
a file caught half-written by the watcher would take a running server down -- so it logs the
problem and leaves the definitions already serving in place, then picks the file up again once it
is saved correctly. Replacing them is synchronous, so a request in flight sees either the whole old
set or the whole new one.

Set `RESOURCES_WATCH=false` to turn watching off. Filesystems that cannot watch are logged at
startup and the server runs on with what it read at boot.

### CORS

fn is a plain `<script>` page that can be served from anywhere, including `file://` (whose `Origin`
is the literal `null`), so `src/middlewares/cors.middleware.js` allows `*` by default. Set
`CORS_ORIGIN` to pin it to one origin in production.
