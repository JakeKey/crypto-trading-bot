CREATE TYPE "position_status" AS ENUM (
  'open',
  'closed'
);

CREATE TABLE "positions" (
  "id" SERIAL PRIMARY KEY,
  "token_identifier" varchar(63) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "pnl" DOUBLE PRECISION,
  "position_status" position_status DEFAULT 'open',
  "created_at" timestamp DEFAULT (now())
);
