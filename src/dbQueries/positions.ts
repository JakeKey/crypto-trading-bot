import { Varchar } from "@prisma/orm-postgres/target/codec-types";

import { db } from "../prisma/db";

export const getPositionByStatus = async (status: "open" | "closed") => {
  return await db.orm.public.Positions.select(
    "id",
    "tokenIdentifier",
    "amount",
    "price",
  )
    .where({
      positionStatus: status,
    })
    .all();
};

export const createNewPosition = async (
  amount: number,
  tokenIdentifier: string,
  price: number,
) => {
  return await db.orm.public.Positions.create({
    amount,
    tokenIdentifier: tokenIdentifier as Varchar<63>,
    price,
  });
};

export const closePosition = async (positionId: number, pnl: number) => {
  return await db.orm.public.Positions.where({ id: positionId }).update({
    positionStatus: "closed",
    pnl,
  });
};
