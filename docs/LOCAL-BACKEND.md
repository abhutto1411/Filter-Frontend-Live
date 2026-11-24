# Local backend

Point the Vite app at a local Nest API with:

```bash
# filter-web/.env.development (tracked)
VITE_API_BASE_URL=http://localhost:3000
```

`src/services/api.js` resolves the origin via `resolveApiBaseUrl`. Production builds **fail closed** if `VITE_API_BASE_URL` is missing (approval item 11: every FE host must set it before deploy).

In development, a footer badge shows `API: <origin>` so you can confirm you are not hitting Railway staging.
