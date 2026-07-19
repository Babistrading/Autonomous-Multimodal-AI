import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const datasetsTable = pgTable("datasets", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // language, coding, math, reasoning, science, instruction
  totalSamples: integer("total_samples").notNull().default(0),
  qualityScore: real("quality_score").notNull().default(0.85),
  sizeKb: integer("size_kb").notNull().default(0),
  status: text("status").notNull().default("ready"), // "ready" | "generating" | "cleaning"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDatasetSchema = createInsertSchema(datasetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasetsTable.$inferSelect;
