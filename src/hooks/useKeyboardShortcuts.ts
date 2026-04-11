import { useEffect } from 'react'

export interface Shortcut {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  description: string
  handler: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const sc of shortcuts) {
        const keyMatch   = e.key.toLowerCase() === sc.key.toLowerCase()
        const metaMatch  = sc.meta  ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)
        const ctrlMatch  = sc.ctrl  ? e.ctrlKey  : !e.ctrlKey
        const shiftMatch = sc.shift ? e.shiftKey : !e.shiftKey
        if (keyMatch && metaMatch && ctrlMatch && shiftMatch) {
          e.preventDefault()
          sc.handler()
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}
