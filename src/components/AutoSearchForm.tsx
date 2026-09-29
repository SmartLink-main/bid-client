import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

type AutoSearchFormProps = {
  children: ReactNode
  className?: string
  onSearch: () => void
}

// Wait for controlled fields to commit before searching. Text entry is debounced;
// selects, radios and buttons marked data-auto-search apply immediately.
export default function AutoSearchForm({ children, className, onSearch }: AutoSearchFormProps) {
  const search = useRef(onSearch)
  const timer = useRef<number | undefined>(undefined)
  const isComposing = useRef(false)

  useLayoutEffect(() => {
    search.current = onSearch
  }, [onSearch])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const schedule = (delay = 0) => {
    window.clearTimeout(timer.current)
    if (isComposing.current) return
    timer.current = window.setTimeout(() => search.current(), delay)
  }

  return (
    <form
      className={className}
      onChange={(event) => {
        const target = event.target
        const isChoice = target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement && ['radio', 'checkbox'].includes(target.type))
        schedule(isChoice ? 0 : 400)
      }}
      onClick={(event) => {
        const target = event.target
        // A checked radio does not fire change again; clicking it still retries.
        if ((target instanceof HTMLInputElement && target.type === 'radio') ||
          (target instanceof Element && target.closest('button[data-auto-search]'))) schedule()
      }}
      onCompositionStart={() => {
        isComposing.current = true
        window.clearTimeout(timer.current)
      }}
      onCompositionEnd={() => {
        isComposing.current = false
        schedule(400)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          if (!event.nativeEvent.isComposing) schedule()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        schedule()
      }}
    >
      {children}
    </form>
  )
}
