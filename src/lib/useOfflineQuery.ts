import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { convexToJson, jsonToConvex } from "convex/values";
import { useEffect } from "react";

export function useOfflineQuery(reference: any, args: any, defaultData: any) {
  const key = JSON.stringify({
    fn: getFunctionName(reference),
    args: convexToJson(args),
  });
  const cached = localStorage.getItem(key);
  const remote = useQuery(reference, args);
  useEffect(() => {
    if (remote !== undefined) {
      localStorage.setItem(key, JSON.stringify(convexToJson(remote)));
    }
  }, [key, remote]);
  return remote === undefined
    ? cached === null
      ? defaultData
      : { data: jsonToConvex(JSON.parse(cached)), cached: true }
    : { data: remote, remote: true };
}
