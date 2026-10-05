# Orion

Starforge Foundry internal application for managing the makerspace.

## Development

```sh
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

Database tests need `TEST_DATABASE_URL=postgres://orion:orion@localhost:5432/orion_test pnpm test`.

To run the production image locally: `docker compose --profile app up --build`.
