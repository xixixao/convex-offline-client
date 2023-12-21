import {
  QueryBuilder,
  useSyncQuery as useSyncQueryGeneric,
  useSyncMutation as useSyncMutationGeneric,
  offlineQuery as offlineQueryGeneric,
  offlineMutation as offlineMutationGeneric,
  OfflineQueryCtx as OfflineQueryCtxGeneric,
  OfflineMutationCtx as OfflineMutationCtxGeneric,
  MutationBuilder,
  UseSyncQuery,
  UseSyncMutation,
} from "@/lib/ConvexOfflineClient";
import {
  defineSchema,
  defineTable,
  DataModelFromSchemaDefinition,
  TableNamesInDataModel,
  DocumentByName,
} from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  numbers: defineTable({
    value: v.number(),
    synced: v.boolean(),
  }),
});

type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export type OfflineQueryCtx = OfflineQueryCtxGeneric<DataModel>;
export type OfflineMutationCtx = OfflineMutationCtxGeneric<DataModel>;
export type OfflineTable = TableNamesInDataModel<DataModel>;
export type OfflineDoc<TableName extends OfflineTable> = DocumentByName<
  DataModel,
  TableName
>;

export const offlineQuery: QueryBuilder<DataModel> = offlineQueryGeneric;
export const offlineMutation: MutationBuilder<DataModel> =
  offlineMutationGeneric;
export const useSyncQuery: UseSyncQuery<DataModel> = useSyncQueryGeneric;
export const useSyncMutation: UseSyncMutation<DataModel> =
  useSyncMutationGeneric;
