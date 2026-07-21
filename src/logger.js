import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import winston from "winston";

const logDirectory = path.resolve("logs");
fs.mkdirSync(logDirectory, { recursive: true });

const consoleFormat = winston.format.printf(({ timestamp, level, message }) => {
  const colors = { error: chalk.red, warn: chalk.yellow, info: chalk.cyan, debug: chalk.gray };
  return `${chalk.gray(timestamp)} ${colors[level]?.(level.toUpperCase()) || level.toUpperCase()} ${message}`;
});

/** Application logger with colored console and durable file output. */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true })),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({ filename: path.join(logDirectory, "hunter.log"), format: winston.format.json() })
  ]
});

/** Close log transports after the final message has been written. */
export function closeLogger() {
  return new Promise((resolve) => {
    logger.on("finish", resolve);
    logger.end();
  });
}
