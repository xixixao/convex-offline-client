import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Expand,
  useOfflineMutation,
  useOfflineQuery,
} from "@/lib/ConvexOfflineClient";
import {
  OfflineDoc,
  OfflineId,
  OfflineMutationCtx,
  offlineMutation,
  offlineQuery,
  useSyncMutation,
  useSyncQuery,
} from "@/lib/offlineDatabase";
import { getUnsynced, syncServerValues } from "@/lib/offlineHelpers";
import { useControls } from "@/useControls";
import { WithoutSystemFields } from "convex/server";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { resolveChanges } from "@/../convex/myFunctions";
import { TrashIcon } from "@radix-ui/react-icons";

// We have a completely separate client model from server model
// Mutations will affect the client model
// The client model will then issue mutation to the server
// The client controls when exactly the sync happens (when user goes online,
// or when user pays for a subscription)
// The client model includes server data, and always knows which
// data is client side or server side.
// This knowledge allows it to sync to server correctly.

// Very simple client model: A list of numbers
// Server also holds a list of numbers
// On client we have {value: number, uuid: string, synced: boolean}[]
// On server we have {value: number, uuid: string}[]
// uuid is important so that we can identify that our number
// made it to the server and back.
// when we load data, we ignore all client numbers that came from the server
// when we save data, we ignore all server numbers that came from the client
// when we want to sync to server, we grab the numbers that are not synced,
// and we send them via single mutation to server
// we can update client store when our numbers come back from the server
// a simple syncing model issues sync to server every time the user
// issues a mutation

// the client store should be persistent, localStorage for example
// in the browser, asyncstorage in RN,
// an in-memory store could be used for buffering/debouncing
// writes to the persistent store

// a write to the store is:
// 1. generate uuid
// 2. write to local store
// 3. if online, sync to server

// the store is subscribed to the server via a number
// of subscriptions, which themselves populate the store

const listTodos = offlineQuery(async (ctx, args: { count: number }) => {
  return (await ctx.db.query("todos").order("desc").take(args.count)).filter(
    (todo) => todo.deletedTime === null
  );
});

const insertTodo = offlineMutation(async (ctx, { text }: { text: string }) => {
  await ctx.db.insert("todos", {
    text,
    synced: false,
    completed: false,
    completedChangedTime: Date.now(),
    deletedTime: null,
  });
});

const updateTodo = offlineMutation(
  async (
    ctx,
    { _id, completed }: { _id: OfflineId<"todos">; completed: boolean }
  ) => {
    await ctx.db.patch(_id, {
      completed,
      completedChangedTime: Date.now(),
      synced: false,
    });
  }
);

const deleteTodo = offlineMutation(
  async (ctx, { _id }: { _id: OfflineId<"todos"> }) => {
    await ctx.db.patch(_id, {
      deletedTime: Date.now(),
      synced: false,
    });
  }
);

async function syncTodos(
  ctx: OfflineMutationCtx,
  documents: Expand<
    Omit<WithoutSystemFields<OfflineDoc<"todos">>, "synced"> & {
      clientId: string;
      clientCreationTime: number;
    }
  >[]
) {
  await syncServerValues(ctx, "todos", documents, resolveChanges);
}

export default function App() {
  const { online, syncOn, controls } = useControls();
  const todos = useOfflineQuery(listTodos, { count: 10 });

  const addTodo = useOfflineMutation(insertTodo);
  const changeCompleted = useOfflineMutation(updateTodo);
  const changeDeleted = useOfflineMutation(deleteTodo);
  const addTodosOnServer = useSyncMutation(api.myFunctions.addTodos);
  const syncTodosToServer = useCallback(async () => {
    await addTodosOnServer(async (ctx) => ({
      todos: await getUnsynced(ctx, "todos"),
    }));
  }, [addTodosOnServer]);

  useSyncQuery(
    api.myFunctions.listTodos,
    online ? { count: 10 } : "skip",
    syncTodos
  );

  useEffect(() => {
    if (syncOn) {
      void syncTodosToServer();
    }
  }, [syncTodosToServer, syncOn]);

  const [text, setText] = useState("");

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Convex Offline Todo List
      </h1>
      {controls}
      <div className="flex items-stretch gap-2">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button
          className="flex h-auto"
          disabled={text === ""}
          onClick={() => {
            void (async () => {
              await addTodo({ text });
              if (!syncOn) {
                return;
              }
              await syncTodosToServer();
            })();
            setText("");
          }}
        >
          Add
        </Button>
      </div>
      <div>
        {todos?.length === 0 ? (
          "Add a todo"
        ) : (
          <div className="flex flex-col gap-1">
            {todos?.map(({ text, completed, synced, _id }) => (
              <div key={_id} className="flex gap-2 items-center">
                <div
                  className={cn(
                    "flex flex-grow gap-2 bg-secondary p-2 rounded-lg border items-center",
                    synced ? "border-transparent" : "border-red-500"
                  )}
                >
                  <Checkbox
                    checked={completed}
                    onCheckedChange={(checked) => {
                      const completed = checked === true;
                      void (async () => {
                        await changeCompleted({ _id, completed });
                        if (!syncOn) {
                          return;
                        }
                        await syncTodosToServer();
                      })();
                    }}
                  />
                  <div className="flex-grow">{text}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-destructive/20 hover:text-red-500"
                >
                  <TrashIcon
                    className="h-4 w-4"
                    onClick={() => {
                      void (async () => {
                        await changeDeleted({ _id });
                        if (!syncOn) {
                          return;
                        }
                        await syncTodosToServer();
                      })();
                    }}
                  />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
