import { Link } from "@/components/typography/link";
import { Button } from "@/components/ui/button";
import { useCachedQuery } from "@/lib/useCachedQuery";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

function App() {
  const numbers = useCachedQuery(api.myFunctions.listNumbers, { count: 10 });
  const addNumber = useMutation(api.myFunctions.addNumber);

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
            void addNumber({ value: Math.floor(Math.random() * 10) });
          }}
        >
          Add a random number
        </Button>
      </p>
      {numbers === undefined ? (
        <Skeleton className="w-24 h-6" />
      ) : (
        <p className={numbers.cached ? "text-gray-400" : ""}>
          Numbers:{" "}
          {numbers.data.length === 0
            ? "Click the button!"
            : numbers.data.join(", ") ?? "..."}
        </p>
      )}
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
