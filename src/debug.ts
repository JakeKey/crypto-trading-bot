import logger, { LoggerOptions } from "pino";

import { DebugLevels } from "./types/enums";

const transport = {
  target: "pino-pretty",
};

const loggerOptions: LoggerOptions = {
  transport,
  nestedKey: "payload",
};

export const createDebug =
  (postfix: string) =>
  (message: string | object, debugLevel = DebugLevels.INFO) => {
    switch (debugLevel) {
      case DebugLevels.INFO:
        logger(loggerOptions).info(`${postfix}::${message}`);
        return;
      case DebugLevels.WARN:
        logger(loggerOptions).warn(`${postfix}::${message}`);
        return;
      case DebugLevels.ERROR:
        logger(loggerOptions).error(`${postfix}::${message}`);
        return;
      default:
        logger(loggerOptions).info(`${postfix}::${message}`);
    }
  };
