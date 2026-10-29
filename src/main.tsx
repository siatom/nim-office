import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// The WebView's native menu (reload, print, inspect) belongs to the browser, not
// to a desktop editor, so right-click never opens it.
document.addEventListener("contextmenu", (event) => event.preventDefault());

// StrictMode is intentionally omitted: the document engine mounts once and
// owns its DOM/scroll state, so the dev-only double mount is not worth the churn.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
