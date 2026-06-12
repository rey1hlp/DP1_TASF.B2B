import { useEffect, type ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import type { AppLayoutContext } from '../layouts/AppLayout'

export function useTopbarMain(content: ReactNode) {
  const { setTopbarMain } = useOutletContext<AppLayoutContext>()

  useEffect(() => {
    setTopbarMain(content)

    return () => {
      setTopbarMain(null)
    }
  }, [content, setTopbarMain])
}