import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "./swRegistration";

registerSW((changes) => {
  import("./services/DataService").then(({ DataService }) => {
    changes.forEach((c: any) => DataService.applyRemoteChange(c));
  });
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
