import { createContext, useState } from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"

export const ToastContext = createContext({})

export function ToastContextProvider({
  children,
}) {
  const [toasts, setToasts] = useState([])

  const toast = ({ title, description, variant }) => {
    setToasts((currentToasts) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = {
        id,
        title,
        description,
        variant,
      }
      
      setTimeout(() => {
        setToasts((currentToasts) =>
          currentToasts.filter((toast) => toast.id !== id)
        )
      }, 5000)

      return [...currentToasts, newToast]
    })
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider>
        {children}
        {toasts.map(({ id, title, description, variant }) => (
          <Toast key={id} variant={variant}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  )
}
