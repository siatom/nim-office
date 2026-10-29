import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// StrictMode is intentionally omitted: the document engine mounts once and
// owns its DOM/scroll state, so the dev-only double mount is not worth the churn.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
