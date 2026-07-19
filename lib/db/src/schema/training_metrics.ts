import { pgTable, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingMetricsTable = pgTable("training_metrics", {
  id: serial("id").primaryKey(),
  epoch: integer("epoch").notNull().default(0),
  step: integer("step").notNull().default(0),
  loss: real("loss").notNull(),
  validationLoss: real("validation_loss"),
  perplexity: real("perplexity").notNull(),
  learningRate: real("learning_rate").notNull(),
  tokensPerSecond: real("tokens_per_second").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingMetricSchema = createInsertSchema(trainingMetricsTable).omit({ id: true, createdAt: true });
export type InsertTrainingMetric = z.infer<typeof insertTrainingMetricSchema>;
export type TrainingMetric = typeof trainingMetricsTable.$inferSelect;
