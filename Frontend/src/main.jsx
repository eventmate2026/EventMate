import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./context/ThemeContext"
import ToastViewport from "./components/ToastViewport"

const appTree = (
  <ThemeProvider>
    <App />
    <ToastViewport />
  </ThemeProvider>
)

ReactDOM.createRoot(document.getElementById("root")).render(
  import.meta.env.DEV ? appTree : <React.StrictMode>{appTree}</React.StrictMode>
)
