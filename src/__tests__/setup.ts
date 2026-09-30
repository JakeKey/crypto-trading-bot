import { afterEach } from "mocha";
import sinon from "sinon";

import { db } from "../prisma/db";

afterEach(() => {
  sinon.restore();
});

export const cleanTestDatabase = async () => {
  return db.orm.public.Positions.where({}).deleteAll();
};
