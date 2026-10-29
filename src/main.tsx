import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// StrictMode is intentionally omitted: SuperDoc is an imperative editor that
// does not tolerate the double mount/unmount cycle React performs in dev mode.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
