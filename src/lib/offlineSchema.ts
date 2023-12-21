import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const schema = defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
    synced: v.boolean(),
  }),
});
