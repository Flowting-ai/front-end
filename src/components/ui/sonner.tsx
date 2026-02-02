"use client"

import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { useTheme } from "next-themes"

const Toaster = () => {
  const { theme = "system" } = useTheme()
  const resolvedTheme = theme === "system" ? "light" : theme

  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3333}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={resolvedTheme as "light" | "dark"}
      className="font-geist"
    />
  )
}

export { Toaster }
