import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./context/ToastContext"

const appTree = (
  <ToastProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ToastProvider>
)

ReactDOM.createRoot(document.getElementById("root")).render(
  import.meta.env.DEV ? appTree : <React.StrictMode>{appTree}</React.StrictMode>
)
