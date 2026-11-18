import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export default function ScrollToTop() {
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = router.subscribe('onResolved', ({ fromLocation, toLocation }) => {
      if (fromLocation?.pathname !== toLocation.pathname) {
        window.scrollTo(0, 0)
      }
    })

    return () => unsubscribe() // Cleanup the subscription on unmount
  }, [router])

  return null
}
