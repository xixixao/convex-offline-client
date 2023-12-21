import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    todos: defineTable({
      clientCreationTime: v.number(),
      clientId: v.string(),
      completed: v.boolean(),
      completedChangedTime: v.number(),
      text: v.string(),
    })
      .index("clientCreationTime", ["clientCreationTime"])
      .index("clientId", ["clientId"]),
  },
  { schemaValidation: true }
);
