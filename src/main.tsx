import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import {
  ConvexOfflineClient,
  ConvexOfflineProvider,
} from "@/lib/ConvexOfflineClient";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const offlineClient = new ConvexOfflineClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={client}>
      <ConvexOfflineProvider client={offlineClient}>
        <App />
      </ConvexOfflineProvider>
    </ConvexProvider>
  </React.StrictMode>
);
