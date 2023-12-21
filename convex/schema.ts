import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    numbers: defineTable({
      clientCreationTime: v.number(),
      clientId: v.string(),
      value: v.number(),
    })
      .index("clientCreationTime", ["clientCreationTime"])
      .index("clientId", ["clientId"]),
  },
  { schemaValidation: true }
);
