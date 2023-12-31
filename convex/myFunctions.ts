import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { vTodoFields } from "./schema";

export const listTodos = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const todos = await ctx.db
      .query("todos")
      .withIndex("clientCreationTime")
      .order("desc")
      .take(args.count);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return todos.map(({ _id, _creationTime, ...fields }) => fields);
  },
});

export const addTodos = mutation({
  args: {
    todos: v.array(v.object(vTodoFields)),
  },
  handler: async (ctx, args) => {
    for (const todo of args.todos) {
      const existing = await ctx.db
        .query("todos")
        .withIndex("clientId", (q) => q.eq("clientId", todo.clientId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("todos", todo);
      } else {
        await ctx.db.patch(existing._id, {
          ...todo,
          ...resolveChanges(existing, todo),
        });
      }
    }
  },
});

export function resolveChanges(
  existing: {
    completed: boolean;
    completedChangedTime: number;
    deletedTime: number | null;
  },
  incoming: {
    completed: boolean;
    completedChangedTime: number;
    deletedTime: number | null;
  }
) {
  const { completed, completedChangedTime } =
    incoming.completedChangedTime > existing.completedChangedTime
      ? incoming
      : existing;

  const deletedTime = incoming.deletedTime ?? existing.deletedTime;
  return {
    completed,
    completedChangedTime,
    deletedTime:
      deletedTime !== null && deletedTime > completedChangedTime
        ? deletedTime
        : null,
  };
}
