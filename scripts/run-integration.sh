#!/usr/bin/env bash
# src/run-integration.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
source $DIR/setenv.sh
docker compose up -d
sleep 5
# npx prisma migrate dev --name init
npx prisma db migrate --advance-ref db
mocha --file src/__tests__/setup.ts -r ts-node/register 'src/__tests__/**/*.spec.ts' --exit