import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listNumbers = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const numbers = await ctx.db
      .query("numbers")
      .withIndex("clientCreationTime")
      .order("desc")
      .take(args.count);
    return (
      numbers
        .toReversed()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ _id, _creationTime, ...fields }) => fields)
    );
  },
});

export const addNumbers = mutation({
  args: {
    numbers: v.array(
      v.object({
        clientCreationTime: v.number(),
        clientId: v.string(),
        value: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const number of args.numbers) {
      const existing = await ctx.db
        .query("numbers")
        .withIndex("clientId", (q) => q.eq("clientId", number.clientId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("numbers", number);
      }
    }
  },
});
