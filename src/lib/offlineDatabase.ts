import {
  MutationBuilder,
  OfflineMutationCtx as OfflineMutationCtxGeneric,
  OfflineQueryCtx as OfflineQueryCtxGeneric,
  QueryBuilder,
  UseSyncMutation,
  UseSyncQuery,
  offlineMutation as offlineMutationGeneric,
  offlineQuery as offlineQueryGeneric,
  useSyncMutation as useSyncMutationGeneric,
  useSyncQuery as useSyncQueryGeneric,
} from "@/lib/ConvexOfflineClient";
import { schema } from "@/lib/offlineSchema";
import {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
} from "convex/server";

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
