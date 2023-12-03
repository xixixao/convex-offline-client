import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listNumbers = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const numbers = await ctx.db
      .query("numbers")
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
    numbers: v.array(v.object({ clientId: v.string(), value: v.number() })),
  },
  handler: async (ctx, args) => {
    await Promise.all(
      args.numbers.map(async (doc) => {
        await ctx.db.insert("numbers", doc);
      })
    );
  },
});

// // You can fetch data from and send data to third-party APIs via an action:
// export const myAction = action({
//   // Validators for arguments.
//   args: {
//     first: v.number(),
//     second: v.string(),
//   },

//   // Action implementation.
//   handler: async (ctx, args) => {
//     //// Use the browser-like `fetch` API to send HTTP requests.
//     //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
//     // const response = await ctx.fetch("https://api.thirdpartyservice.com");
//     // const data = await response.json();

//     //// Query data by running Convex queries.
//     const data = await ctx.runQuery(api.myFunctions.listNumbers, {
//       count: 10,
//     });
//     console.log(data);

//     //// Write data by running Convex mutations.
//     await ctx.runMutation(api.myFunctions.addNumber, {
//       value: args.first,
//     });
//   },
// });
