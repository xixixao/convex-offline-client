/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable react-refresh/only-export-components */
import { useSubscription } from "@/lib/useSubscription";
import { useConvex } from "convex/react";
import {
  DocumentByName,
  FunctionReference,
  GenericDataModel,
  GenericDocument,
  GenericTableInfo,
  NamedTableInfo,
  Query,
  QueryInitializer,
  TableNamesInDataModel,
  WithoutSystemFields,
} from "convex/server";
import { GenericId, JSONValue, Value, convexToJson } from "convex/values";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

export class ConvexOfflineClient {
  tables = new Map<string, any[]>();
  listeners: (() => void)[] = [];
  queries: [OfflineFunctionReference<any>, Record<string, Value>][] = [];
  queryResults: Map<OfflineFunctionReference<any>, Record<string, unknown>> =
    new Map();

  constructor() {}

  update(table: string, docs: any[]) {
    this.tables.set(table, docs);
    this.recompute();
  }

  private recompute() {
    this.queries.forEach(([query, args]) => {
      void (async () => {
        const db = getReader(this);
        const result = await (query as any)({ db }, args);
        const serializedArgs = JSON.stringify(convexToJson(args));
        this.queryResults.set(query, {
          ...(this.queryResults.get(query) ?? {}),
          [serializedArgs]: result,
        });
        this.notifyAll();
      })();
    });
  }

  private notifyAll() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe<
    FuncRef extends OfflineFunctionReference<any>,
    Args extends Record<string, Value>
  >(funcRef: FuncRef, args: Args, callback: () => void) {
    this.listeners.push(callback);
    this.queries.push([funcRef, args]);
    this.recompute();
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  retrieve<FuncRef extends OfflineFunctionReference<any>>(
    funcRef: FuncRef,
    serializedArgs: string
  ): FuncRef["_output"] | undefined {
    const result = this.queryResults.get(funcRef);
    if (!result) {
      return undefined;
    }
    return result[serializedArgs] as FuncRef["_output"];
  }
}

const ConvexOfflineContext = createContext<ConvexOfflineClient | undefined>(
  undefined
);

export const useOfflineConvex = (): ConvexOfflineClient => {
  return useContext(ConvexOfflineContext)!;
};

export function ConvexOfflineProvider({
  client,
  children,
}: {
  client: ConvexOfflineClient;
  children: ReactNode;
}) {
  return (
    <ConvexOfflineContext.Provider value={client}>
      {children}
    </ConvexOfflineContext.Provider>
  );
}

export type OfflineQueryCtx<DataModel extends GenericDataModel> = {
  db: GenericDatabaseReader<DataModel>;
};

export type OfflineMutationCtx<DataModel extends GenericDataModel> = {
  db: GenericDatabaseWriter<DataModel>;
};

export type EmptyObject = Record<string, never>;

export type FunctionType = "query" | "mutation";

export type OfflineFunctionReference<
  Type extends FunctionType,
  Args extends Record<string, unknown> = any,
  Output = any
> = {
  _type: Type;
  _args: Args;
  _output: Output;
};

export type OptionalRestArgsOrSkip<
  FuncRef extends OfflineFunctionReference<any>
> = FuncRef["_args"] extends EmptyObject
  ? [args?: EmptyObject | "skip"]
  : [args: FuncRef["_args"] | "skip"];

export type QueryBuilder<DataModel extends GenericDataModel> = <
  Output,
  Args extends Record<string, unknown>
>(
  implementation: (
    ctx: OfflineQueryCtx<DataModel>,
    args: Args
  ) => Promise<Output>
) => OfflineFunctionReference<"query", Args, Output>;

export type MutationBuilder<DataModel extends GenericDataModel> = <
  Output,
  Args extends Record<string, unknown>
>(
  implementation: (
    ctx: OfflineMutationCtx<DataModel>,
    args: Args
  ) => Promise<Output>
) => OfflineFunctionReference<"mutation", Args, Output>;

export const offlineQuery: QueryBuilder<any> = (implementation) => {
  return implementation as any;
};

export const offlineMutation: MutationBuilder<any> = (implementation) => {
  return implementation as any;
};

export function useOfflineQuery<
  Query extends OfflineFunctionReference<"query">
>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_output"] | undefined {
  const client = useOfflineConvex();
  const serializedArgs = JSON.stringify(convexToJson(args[0] ?? {}));
  return useSubscription(
    useMemo(
      () => ({
        getCurrentValue: () => {
          return args[0] === "skip"
            ? undefined
            : client.retrieve(query, serializedArgs);
        },
        subscribe: (callback) => {
          if (args[0] === "skip") {
            return () => {};
          }
          return client.subscribe(query, args[0] ?? {}, () => {
            callback();
          });
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [client, query, serializedArgs]
    )
  );
}

export function useOfflineMutation<
  Mutation extends OfflineFunctionReference<"mutation">
>(
  mutation: Mutation
): (...args: OptionalRestArgsOrSkip<Mutation>) => Promise<Mutation["_output"]> {
  const client = useOfflineConvex();
  return useCallback(
    async (...args) => {
      const db = getWriter(client);
      return await (mutation as any)({ db }, args[0] ?? {});
    },
    [client, mutation]
  );
}

export type UseSyncQuery<DataModel extends GenericDataModel> = <
  Query extends FunctionReference<"query">
>(
  query: Query,
  args: Query["_args"],
  callback: (
    ctx: OfflineMutationCtx<DataModel>,
    result: Query["_returnType"]
  ) => Promise<void>
) => void;

/**
 * Do not forget to memoize callback if you're passing it inline!
 */
export const useSyncQuery: UseSyncQuery<any> = (query, args, callback) => {
  const reactClient = useConvex();
  const client = useOfflineConvex();
  const serializedArgs = JSON.stringify(convexToJson(args));
  useEffect(
    () => {
      const watch = reactClient.watchQuery(query, args);
      return watch.onUpdate(() => {
        const result = watch.localQueryResult();
        void callback({ db: getWriter(client) }, result);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, client, query, reactClient, serializedArgs]
  );
};

export type UseSyncMutation<DataModel extends GenericDataModel> = <
  Mutation extends FunctionReference<"mutation">
>(
  mutation: Mutation
) => (
  callback: (ctx: OfflineQueryCtx<DataModel>) => Promise<Mutation["_args"]>
) => Promise<void>;

export const useSyncMutation: UseSyncMutation<any> = (mutation) => {
  const reactClient = useConvex();
  const client = useOfflineConvex();
  return useCallback(
    async (callback) => {
      const args = await callback({ db: getReader(client) });
      await reactClient.mutation(mutation, args);
    },
    [client, mutation, reactClient]
  );
};

function getReader(
  client: ConvexOfflineClient
): GenericDatabaseReader<GenericDataModel> {
  return {
    get: async (id: GenericId<string>) => {
      validateArg(id, 1, "get", "id");
      if (typeof id !== "string") {
        throw new Error(
          `Invalid argument \`id\` for \`db.get\`, expected string but got '${typeof id}': ${
            id as any
          }`
        );
      }

      for (const table of client.tables.values()) {
        const doc = table.find((doc) => doc._id === id);
        if (doc) {
          return doc;
        }
      }
      return null;
    },
    query: (tableName: string) => {
      return new QueryInitializerImpl(tableName, client);
    },
    normalizeId: null as any,
    // normalizeId: <TableName extends string>(
    //   tableName: TableName,
    //   id: string
    // ): GenericId<TableName> | null => {
    //   validateArg(tableName, 1, "normalizeId", "tableName");
    //   validateArg(id, 2, "normalizeId", "id");
    //   const accessingSystemTable = tableName.startsWith("_");
    //   if (accessingSystemTable !== isSystem) {
    //     throw new Error(
    //       `${
    //         accessingSystemTable ? "System" : "User"
    //       } tables can only be accessed from db.${
    //         isSystem ? "" : "system."
    //       }normalizeId().`
    //     );
    //   }
    //   const syscallJSON = performSyscall("1.0/db/normalizeId", {
    //     table: tableName,
    //     idString: id,
    //   });
    //   const syscallResult = jsonToConvex(syscallJSON, false) as any;
    //   return syscallResult.id;
    // },
  };
}

function validateArg(arg: any, idx: number, method: string, argName: string) {
  if (arg === undefined) {
    throw new Error(`Must provide arg ${idx} \`${argName}\` to \`${method}\``);
  }
}

interface BaseDatabaseReader<DataModel extends GenericDataModel> {
  /**
   * Fetch a single document from the database by its {@link values.GenericId}.
   *
   * @param id - The {@link values.GenericId} of the document to fetch from the database.
   * @returns - The {@link GenericDocument} of the document at the given {@link values.GenericId}, or `null` if it no longer exists.
   */
  get<TableName extends TableNamesInDataModel<DataModel>>(
    id: GenericId<TableName>
  ): Promise<DocumentByName<DataModel, TableName> | null>;

  /**
   * Begin a query for the given table name.
   *
   * Queries don't execute immediately, so calling this method and extending its
   * query are free until the results are actually used.
   *
   * @param tableName - The name of the table to query.
   * @returns - A {@link QueryInitializer} object to start building a query.
   */
  query<TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName
  ): QueryInitializer<NamedTableInfo<DataModel, TableName>>;

  /**
   * Returns the string ID format for the ID in a given table, or null if the ID
   * is from a different table or is not a valid ID.
   *
   * This accepts the string ID format as well as the `.toString()` representation
   * of the legacy class-based ID format.
   *
   * This does not guarantee that the ID exists (i.e. `db.get(id)` may return `null`).
   *
   * @param tableName - The name of the table.
   * @param id - The ID string.
   */
  normalizeId<TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    id: string
  ): GenericId<TableName> | null;
}

/**
 * An interface to read from the database within Convex query functions.
 *
 * The two entry points are:
 *   - {@link GenericDatabaseReader.get}, which fetches a single document
 *     by its {@link values.GenericId}.
 *   - {@link GenericDatabaseReader.query}, which starts building a query.
 *
 * If you're using code generation, use the `DatabaseReader` type in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @public
 */
export interface GenericDatabaseReader<DataModel extends GenericDataModel>
  extends BaseDatabaseReader<DataModel> {}

/**
 * @public
 */
export interface GenericDatabaseWriter<DataModel extends GenericDataModel>
  extends GenericDatabaseReader<DataModel> {
  /**
   * Insert a new document into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link values.Value} to insert into the given table.
   * @returns - {@link values.GenericId} of the new document.
   */
  insert<TableName extends TableNamesInDataModel<DataModel>>(
    table: TableName,
    value: WithoutSystemFields<DocumentByName<DataModel, TableName>>
  ): Promise<GenericId<TableName>>;

  /**
   * Insert a document from the server into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link values.Value} to insert into the given table.
   * @returns - {@link values.GenericId} of the new document.
   */
  sync<TableName extends TableNamesInDataModel<DataModel>>(
    table: TableName,
    value: DocumentByName<DataModel, TableName>
  ): Promise<GenericId<TableName>>;

  /**
   * Patch an existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param id - The {@link values.GenericId} of the document to patch.
   * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch<TableName extends TableNamesInDataModel<DataModel>>(
    id: GenericId<TableName>,
    value: Partial<DocumentByName<DataModel, TableName>>
  ): Promise<void>;

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param id - The {@link values.GenericId} of the document to replace.
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will fill them in.
   */
  replace<TableName extends TableNamesInDataModel<DataModel>>(
    id: GenericId<TableName>,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO
    value: WithOptionalSystemFields<DocumentByName<DataModel, TableName>>
  ): Promise<void>;

  /**
   * Delete an existing document.
   *
   * @param id - The {@link values.GenericId} of the document to remove.
   */
  delete(id: GenericId<TableNamesInDataModel<DataModel>>): Promise<void>;
}

export class QueryInitializerImpl
  implements QueryInitializer<GenericTableInfo>
{
  private tableName: string;
  private client: ConvexOfflineClient;

  constructor(tableName: string, client: ConvexOfflineClient) {
    this.tableName = tableName;
    this.client = client;
  }

  withIndex(): any {}

  withSearchIndex(): any {}

  fullTableScan(): QueryImpl {
    return new QueryImpl({
      source: {
        client: this.client,
        type: "FullTableScan",
        tableName: this.tableName,
        order: null,
      },
      operators: [],
    });
  }

  order(order: "asc" | "desc"): QueryImpl {
    return this.fullTableScan().order(order);
  }

  filter(): any {
    // return this.fullTableScan().filter(predicate);
  }

  limit(n: number) {
    return this.fullTableScan().limit(n);
  }

  collect(): Promise<any[]> {
    return this.fullTableScan().collect();
  }

  take(n: number): Promise<Array<any>> {
    return this.fullTableScan().take(n);
  }

  paginate(): any {}

  first(): Promise<any> {
    return this.fullTableScan().first();
  }

  unique(): Promise<any> {
    return this.fullTableScan().unique();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    return this.fullTableScan()[Symbol.asyncIterator]();
  }
}

export type SerializedRangeExpression = {
  type: "Eq" | "Gt" | "Gte" | "Lt" | "Lte";
  fieldPath: string;
  value: JSONValue;
};

type QueryOperator = { filter: JSONValue } | { limit: number };
type Source =
  | {
      client: ConvexOfflineClient;
      type: "FullTableScan";
      tableName: string;
      order: "asc" | "desc" | null;
    }
  | {
      client: ConvexOfflineClient;
      type: "IndexRange";
      indexName: string;
      range: ReadonlyArray<SerializedRangeExpression>;
      order: "asc" | "desc" | null;
    };

type SerializedQuery = {
  source: Source;
  operators: Array<QueryOperator>;
};

export class QueryImpl implements Query<GenericTableInfo> {
  private state:
    | { type: "preparing"; query: SerializedQuery }
    | { type: "executing"; results: GenericDocument[]; index: number }
    | { type: "closed" }
    | { type: "consumed" };

  constructor(query: SerializedQuery) {
    this.state = { type: "preparing", query };
  }

  private takeQuery(): SerializedQuery {
    if (this.state.type !== "preparing") {
      throw new Error(
        "A query can only be chained once and can't be chained after iteration begins."
      );
    }
    const query = this.state.query;
    this.state = { type: "closed" };
    return query;
  }

  private startQuery() {
    if (this.state.type === "executing") {
      throw new Error("Iteration can only begin on a query once.");
    }
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    const query = this.state.query;

    let results =
      query.source.type === "FullTableScan"
        ? query.source.client.tables.get(query.source.tableName) ?? []
        : [];

    if (query.source.order === "desc") {
      results = results.toReversed();
    }
    query.operators.forEach((operator) => {
      if ("limit" in operator) {
        results = results.slice(0, operator.limit);
      }
      if ("filter" in operator) {
        // TODO
      }
    });

    this.state = { type: "executing", results, index: 0 };
  }

  private closeQuery() {
    this.state = { type: "consumed" };
  }

  order(order: "asc" | "desc"): QueryImpl {
    validateArg(order, 1, "order", "order");
    const query = this.takeQuery();
    if (query.source.order !== null) {
      throw new Error("Queries may only specify order at most once");
    }
    query.source.order = order;
    return new QueryImpl(query);
  }

  filter(): any {}

  limit(n: number): any {
    validateArg(n, 1, "limit", "n");
    const query = this.takeQuery();
    query.operators.push({ limit: n });
    return new QueryImpl(query);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    this.startQuery();
    return this;
  }

  async next(): Promise<IteratorResult<any>> {
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    // Allow calling `.next()` when the query is in "preparing" state to implicitly start the
    // query. This allows the developer to call `.next()` on the query without having to use
    // a `for await` statement.

    if (this.state.type === "preparing") {
      this.startQuery();
    }

    if (this.state.type !== "executing") {
      throw new Error("startQuery invariant failed");
    }

    const value = this.state.results[this.state.index];
    const done = this.state.index >= this.state.results.length;

    if (done) {
      this.closeQuery();
    }
    this.state = {
      type: "executing",
      results: this.state.results,
      index: this.state.index + 1,
    };
    return { value, done };
  }

  return() {
    this.closeQuery();
    return Promise.resolve({ done: true, value: undefined });
  }

  paginate(): any {}

  async collect(): Promise<Array<any>> {
    const out: Value[] = [];
    for await (const item of this) {
      out.push(item);
    }
    return out;
  }

  async take(n: number): Promise<Array<any>> {
    validateArg(n, 1, "take", "n");
    return this.limit(n).collect();
  }

  async first(): Promise<any> {
    const first_array = await this.take(1);
    return first_array.length === 0 ? null : first_array[0];
  }

  async unique(): Promise<any> {
    const first_two_array = await this.take(2);
    if (first_two_array.length === 0) {
      return null;
    }
    if (first_two_array.length === 2) {
      throw new Error("unique() query returned more than one result");
    }
    return first_two_array[0];
  }
}

function throwClosedError(type: "closed" | "consumed"): never {
  throw new Error(
    type === "consumed"
      ? "This query is closed and can't emit any more values."
      : "This query has been chained with another operator and can't be reused."
  );
}

export function getWriter(
  client: ConvexOfflineClient
): GenericDatabaseWriter<GenericDataModel> {
  const reader = getReader(client);
  return {
    get: reader.get,
    query: reader.query,
    normalizeId: reader.normalizeId,
    insert: async (table, value) => {
      validateArg(table, 1, "insert", "table");
      validateArg(value, 2, "insert", "value");

      const _id = "client:" + Math.random();
      const _creationTime = +new Date();

      client.update(table, [
        ...(client.tables.get(table) ?? []),
        { _id, _creationTime, ...value },
      ]);

      return _id as GenericId<any>;
    },
    sync: async (table, value) => {
      validateArg(table, 1, "sync", "table");
      validateArg(value, 2, "sync", "value");

      // We still default in case these for some reason didn't
      // were not provided the server values.
      const _id = "client:" + Math.random();
      const _creationTime = +new Date();

      client.update(table, [
        ...(client.tables.get(table) ?? []),
        { _id, _creationTime, ...value },
      ]);

      return _id as GenericId<any>;
    },
    patch: async (id, value) => {
      validateArg(id, 1, "patch", "id");
      validateArg(value, 2, "patch", "value");

      client.tables.forEach((table, name) => {
        client.update(
          name,
          table.map((doc) => (doc._id === id ? { ...doc, ...value } : doc))
        );
      });
    },
    replace: async (id, value) => {
      validateArg(id, 1, "replace", "id");
      validateArg(value, 2, "replace", "value");
      client.tables.forEach((table, name) => {
        client.update(
          name,
          table.map((doc) => {
            const { _id, _creationTime } = doc;
            return _id === id ? { _id, _creationTime, ...value } : doc;
          })
        );
      });
    },
    delete: async (id) => {
      validateArg(id, 1, "delete", "id");
      client.tables.forEach((table, name) => {
        client.update(
          name,
          table.filter((doc) => doc._id !== id)
        );
      });
    },
  };
}
