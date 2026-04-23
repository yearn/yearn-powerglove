import React from 'react'

function isRootDarkMode(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return document.documentElement.classList.contains('dark')
}

export function useRootDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState(() => isRootDarkMode())

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()

    if (typeof MutationObserver === 'undefined') {
      return undefined
    }

    const observer = new MutationObserver(sync)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}
