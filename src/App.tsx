import { Link } from "@/components/typography/link";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfflineQuery } from "@/lib/useOfflineQuery";
import { jsonToConvex } from "convex/values";
import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai/react";
import { getDefaultStore } from "jotai/vanilla";
import { ConvexClient } from "convex/browser";

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

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL as string);

const numbersAtom = atomWithStorage<
  { value: number; uuid: string; synced: boolean }[]
>("numbers", []);

const clientStore = getDefaultStore();

function syncNumbers() {
  const numbers = clientStore.get(numbersAtom);
  const unsynced = numbers.filter((n) => !n.synced);
  void convex.mutation(api.myFunctions.addNumbers, { numbers: unsynced });
}

function subscribeToNumbers() {
  void convex.onUpdate(
    api.myFunctions.listNumbers,
    { count: 10 },
    (serverNumbers) => {
      const clientNumbers = clientStore.get(numbersAtom);
      const syncedUUIDs = new Set(serverNumbers.map((n) => n.uuid));
      clientStore.set(numbersAtom);
    }
  );
}

function App() {
  const [numbers, setNumbers] = useAtom(numbersAtom);
  // const numbers = useOfflineQuery(
  //   api.myFunctions.listNumbers,
  //   { count: 10 },
  //   []
  // );
  // const addNumber = useMutation(api.myFunctions.addNumber);

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Convex + React (Vite)
      </h1>
      <p>
        Click the button and open this page in another window - this data is
        persisted in the Convex cloud database!
      </p>
      <p>
        <Button
          onClick={() => {
            setNumbers((numbers) => [
              ...numbers,
              {
                value: Math.floor(Math.random() * 10),
                uuid: Math.random() + "",
                synced: false,
              },
            ]);
            syncNumbers();
            // void addNumber({ value: Math.floor(Math.random() * 10) });
          }}
        >
          Add a random number
        </Button>
      </p>
      <p>
        Numbers:{" "}
        {numbers.length === 0
          ? "Click the button!"
          : numbers.map(({ value }) => value).join(", ") ?? "..."}
      </p>
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
