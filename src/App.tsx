import { Link } from "@/components/typography/link";
import { Button } from "@/components/ui/button";
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
  OfflineTable,
  offlineMutation,
  offlineQuery,
  useSyncMutation,
  useSyncQuery,
} from "@/lib/offlineDatabase";
import { WithoutSystemFields } from "convex/server";
import { GenericId } from "convex/values";
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

// function useReadNumbers() {
//   const KEY = "numbers";
//   readConvexFromLocalStorage(KEY);
// }

// function readConvexFromLocalStorage(key: any) {
//   const cached = localStorage.getItem("STORE_"+key);
//   if (cached === null) {
//     return undefined;
//   }
//   return jsonToConvex(JSON.parse(cached));
// }

// const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL as string);

// const numbersAtom = atomWithStorage<
//   { value: number; uuid: string; synced: boolean }[]
// >("numbers", []);

// const clientStore = getDefaultStore();

// function syncNumbers() {
//   const numbers = clientStore.get(numbersAtom);
//   const unsynced = numbers.filter((n) => !n.synced);
//   void convex.mutation(api.myFunctions.addNumbers, { numbers: unsynced });
// }

// function subscribeToNumbers() {
//   void convex.onUpdate(
//     api.myFunctions.listNumbers,
//     { count: 10 },
//     (serverNumbers) => {
//       const clientNumbers = clientStore.get(numbersAtom);
//       const syncedUUIDs = new Set(serverNumbers.map((n) => n.uuid));
//       clientStore.set(numbersAtom);
//     }
//   );
// }

const listNumbers = offlineQuery(async (ctx, args: { count: number }) => {
  const numbers = await ctx.db.query("numbers").order("desc").take(args.count);
  return numbers.toReversed();
});

const insertNumber = offlineMutation(async (ctx, args: { value: number }) => {
  await ctx.db.insert("numbers", {
    value: args.value,
    synced: false,
  });
});

async function syncServerValues<TableName extends OfflineTable>(
  ctx: OfflineMutationCtx,
  table: TableName,
  documents: (Omit<WithoutSystemFields<OfflineDoc<TableName>>, "synced"> & {
    clientId: string;
    clientCreationTime: number;
  })[]
) {
  await Promise.all(
    documents.map(async ({ clientId, clientCreationTime, ...doc }) => {
      const unsynced = await ctx.db.get(clientId as GenericId<any>);
      if (unsynced === null) {
        await ctx.db.insert(table, {
          ...doc,
          _id: clientId,
          _creationTime: clientCreationTime,
          synced: true,
        } as any);
      }
      await ctx.db.patch(clientId as GenericId<any>, { synced: true });
    })
  );
}

async function syncNumbers(
  ctx: OfflineMutationCtx,
  documents: Expand<
    Omit<WithoutSystemFields<OfflineDoc<"numbers">>, "synced"> & {
      clientId: string;
      clientCreationTime: number;
    }
  >[]
) {
  await syncServerValues(ctx, "numbers", documents);
}

async function getUnsyncedNumbers(ctx: OfflineQueryCtx) {
  return { numbers: await getUnsynced(ctx, "numbers") };
}

async function getUnsynced<TableName extends OfflineTable>(
  ctx: OfflineQueryCtx,
  table: TableName
): Promise<
  (Omit<WithoutSystemFields<OfflineDoc<TableName>>, "synced"> & {
    clientId: string;
    clientCreationTime: number;
  })[]
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

function App() {
  const [online, setOnline] = useState(false);
  const [syncOn, setSyncOn] = useState(false);
  const numbers = useOfflineQuery(listNumbers, { count: 10 });

  const addNumber = useOfflineMutation(insertNumber);
  const addNumbersOnServer = useSyncMutation(api.myFunctions.addNumbers);
  useSyncQuery(
    api.myFunctions.listNumbers,
    online ? { count: 10 } : "skip",
    syncNumbers
  );

  useEffect(() => {
    if (syncOn) {
      void addNumbersOnServer(getUnsyncedNumbers);
    }
  }, [addNumbersOnServer, syncOn]);

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Convex Offline Todo List
      </h1>
      <div className="flex justify-between">
        <Button
          onClick={() => {
            void (async () => {
              await addNumber({
                value: Math.floor(Math.random() * 10),
              });
              if (!syncOn) {
                return;
              }
              await addNumbersOnServer(getUnsyncedNumbers);
            })();
          }}
        >
          Add a random number
        </Button>
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
      <div>
        Numbers:{" "}
        {numbers?.length === 0 ? (
          "Click the button!"
        ) : (
          <div className="inline-flex gap-1">
            {numbers?.map(({ value, synced, _id }) => (
              <span key={_id} className={synced ? "" : "text-red-500"}>
                {value}
              </span>
            ))}
          </div>
        )}
      </div>
      <p>
        Edit{" "}
        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
          convex/myFunctions.ts
        </code>{" "}
        to change your backend
      </p>
      <p>
        Edit{" "}
        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
          src/App.tsx
        </code>{" "}
        to change your frontend
      </p>
      <p>
        Check out{" "}
        <Link target="_blank" href="https://docs.convex.dev/home">
          Convex docs
        </Link>
      </p>
    </main>
  );
}

export default App;
