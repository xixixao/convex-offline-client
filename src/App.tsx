import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  Expand,
  useOfflineMutation,
  useOfflineQuery,
} from "@/lib/ConvexOfflineClient";
import {
  OfflineDoc,
  OfflineMutationCtx,
  OfflineQueryCtx,
  offlineMutation,
  offlineQuery,
  useSyncMutation,
  useSyncQuery,
} from "@/lib/offlineDatabase";
import { getUnsynced, syncServerValues } from "@/lib/offlineHelpers";
import { WithoutSystemFields } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";

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
  return await ctx.db.query("todos").order("desc").take(args.count);
});

const insertTodo = offlineMutation(async (ctx, { text }: { text: string }) => {
  await ctx.db.insert("todos", { text, synced: false });
});

async function getUnsyncedTodos(ctx: OfflineQueryCtx) {
  return { todos: await getUnsynced(ctx, "todos") };
}

async function syncTodos(
  ctx: OfflineMutationCtx,
  documents: Expand<
    Omit<WithoutSystemFields<OfflineDoc<"todos">>, "synced"> & {
      clientId: string;
      clientCreationTime: number;
    }
  >[]
) {
  await syncServerValues(ctx, "todos", documents);
}

function App() {
  const [online, setOnline] = useState(false);
  const [syncOn, setSyncOn] = useState(false);
  const todos = useOfflineQuery(listTodos, { count: 10 });

  const addTodo = useOfflineMutation(insertTodo);
  const addTodosOnServer = useSyncMutation(api.myFunctions.addTodos);
  useSyncQuery(
    api.myFunctions.listTodos,
    online ? { count: 10 } : "skip",
    syncTodos
  );

  useEffect(() => {
    if (syncOn) {
      void addTodosOnServer(getUnsyncedTodos);
    }
  }, [addTodosOnServer, syncOn]);

  const [text, setText] = useState("");

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Convex Offline Todo List
      </h1>
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Toggle
            variant="destructive"
            pressed={online}
            onPressedChange={() => {
              if (online) {
                setSyncOn(false);
              }
              setOnline(!online);
            }}
          >
            {online ? <>Online</> : <>Offline</>}
          </Toggle>
          <Toggle
            variant="destructive"
            pressed={syncOn}
            onPressedChange={() => {
              if (!syncOn) {
                setOnline(true);
              }
              setSyncOn(!syncOn);
            }}
          >
            {syncOn ? <>Sync On</> : <>Sync Off</>}
          </Toggle>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button
          className="flex h-auto"
          onClick={() => {
            void (async () => {
              await addTodo({ text });
              if (!syncOn) {
                return;
              }
              await addTodosOnServer(getUnsyncedTodos);
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
            {todos?.map(({ text, synced, _id }) => (
              <div key={_id} className={synced ? "" : "text-red-500"}>
                {text}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
