import { createContext, useContext, useEffect, useMemo, useState } from "react"

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  const resolveInitialTheme = () => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    return prefersDark ? "dark" : "light"
  }
  const [theme, setTheme] = useState(resolveInitialTheme)

  // Apply theme changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  const value = useMemo(() => ({ theme, toggleTheme }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
