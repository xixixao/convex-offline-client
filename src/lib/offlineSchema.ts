import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const schema = defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
    completedChangedTime: v.number(),
    deletedTime: v.union(v.number(), v.null()),
    synced: v.boolean(),
  }),
});
