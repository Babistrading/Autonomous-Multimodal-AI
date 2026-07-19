import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checkpointsTable = pgTable("checkpoints", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  epoch: integer("epoch").notNull().default(0),
  step: integer("step").notNull().default(0),
  loss: real("loss").notNull().default(0),
  sizeMb: real("size_mb").notNull().default(0),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckpointSchema = createInsertSchema(checkpointsTable).omit({ id: true, createdAt: true });
export type InsertCheckpoint = z.infer<typeof insertCheckpointSchema>;
export type Checkpoint = typeof checkpointsTable.$inferSelect;
