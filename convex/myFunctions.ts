import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listTodos = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const numbers = await ctx.db
      .query("todos")
      .withIndex("clientCreationTime")
      .order("desc")
      .take(args.count);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return numbers.map(({ _id, _creationTime, ...fields }) => fields);
  },
});

export const addTodos = mutation({
  args: {
    todos: v.array(
      v.object({
        clientCreationTime: v.number(),
        clientId: v.string(),
        text: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const number of args.todos) {
      const existing = await ctx.db
        .query("todos")
        .withIndex("clientId", (q) => q.eq("clientId", number.clientId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("todos", number);
      }
    }
  },
});
