import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vTodoFields = {
  clientCreationTime: v.number(),
  clientId: v.string(),
  completed: v.boolean(),
  completedChangedTime: v.number(),
  text: v.string(),
  deletedTime: v.union(v.number(), v.null()),
};

export default defineSchema(
  {
    todos: defineTable(vTodoFields)
      .index("clientCreationTime", ["clientCreationTime"])
      .index("clientId", ["clientId"]),
  },
  { schemaValidation: true }
);
