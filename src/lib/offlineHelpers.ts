import { Expand } from "@/lib/ConvexOfflineClient";
import {
  OfflineDoc,
  OfflineMutationCtx,
  OfflineQueryCtx,
  OfflineTable,
} from "@/lib/offlineDatabase";
import { WithoutSystemFields } from "convex/server";
import { GenericId } from "convex/values";

// These are specific to the way we set up our data model, but generic
// in over our tables.
export async function syncServerValues<TableName extends OfflineTable>(
  ctx: OfflineMutationCtx,
  table: TableName,
  documents: (Omit<WithoutSystemFields<OfflineDoc<TableName>>, "synced"> & {
    clientId: string;
    clientCreationTime: number;
  })[],
  conflictResolver: (
    existing: WithoutSystemFields<OfflineDoc<TableName>>,
    incoming: WithoutSystemFields<OfflineDoc<TableName>>
  ) => Partial<WithoutSystemFields<OfflineDoc<TableName>>>
) {
  await Promise.all(
    documents.map(async ({ clientId, clientCreationTime, ...doc }) => {
      const local = (await ctx.db.get(
        clientId as GenericId<TableName>
      )) as OfflineDoc<TableName> | null;
      if (local === null) {
        await ctx.db.insert(table, {
          ...doc,
          _id: clientId,
          _creationTime: clientCreationTime,
          synced: true,
        } as any);
      } else {
        const resolved = conflictResolver(local as any, doc as any);
        const synced = Object.keys(resolved).every(
          (key) => resolved[key] === doc[key as keyof typeof doc]
        );
        await ctx.db.patch(clientId as GenericId<any>, {
          ...doc,
          ...resolved,
          synced,
        });
      }
    })
  );
}

// These are specific to the way we set up our data model, but generic
// in over our tables.
export async function getUnsynced<TableName extends OfflineTable>(
  ctx: OfflineQueryCtx,
  table: TableName
): Promise<
  Expand<
    Omit<WithoutSystemFields<OfflineDoc<TableName>>, "synced"> & {
      clientId: string;
      clientCreationTime: number;
    }
  >[]
> {
  const unSyncedDocs = (
    await ctx.db
      .query(table)
      // TODO: When offline client supports filter()
      // .filter((q) => q.eq(q.field("synced"), false))
      .collect()
  ).filter((doc) => !doc.synced);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return unSyncedDocs.map(({ synced, _id, _creationTime, ...doc }) => ({
    ...doc,
    clientId: _id,
    clientCreationTime: _creationTime,
  })) as any;
}
