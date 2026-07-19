import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingLogsTable = pgTable("training_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"), // "info" | "warn" | "error" | "success"
  message: text("message").notNull(),
  workerName: text("worker_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingLogSchema = createInsertSchema(trainingLogsTable).omit({ id: true, createdAt: true });
export type InsertTrainingLog = z.infer<typeof insertTrainingLogSchema>;
export type TrainingLog = typeof trainingLogsTable.$inferSelect;
