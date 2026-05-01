import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 5005),
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  APP_URL: process.env.APP_URL || "http://localhost:5173",
  API_URL: process.env.API_URL || "http://localhost:5005",
};
