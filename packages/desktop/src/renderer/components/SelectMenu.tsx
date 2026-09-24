import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectMenuOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectMenuProps<T extends string = string> {
  value: T
  options: SelectMenuOption<T>[]
  onChange: (value: T) => void
  className?: string
  buttonClassName?: string
  menuClassName?: string
  ariaLabel?: string
  disabled?: boolean
  placeholder?: string
}

/**
 * Accessible, non-native select used throughout the renderer.
 * Keeping the menu in the component makes it usable in both Electron and Web.
 */
export default function SelectMenu<T extends string = string>({
  value,
  options,
  onChange,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel,
  disabled = false,
  placeholder = '请选择',
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value)
    )
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [options, value])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const findEnabledIndex = (start: number, direction: 1 | -1) => {
    if (options.length === 0) return -1
    let index = start
    for (let count = 0; count < options.length; count += 1) {
      if (index < 0) index = options.length - 1
      if (index >= options.length) index = 0
      if (!options[index]?.disabled) return index
      index += direction
    }
    return -1
  }

  const selectIndex = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = findEnabledIndex(
        highlightedIndex + (event.key === 'ArrowDown' ? 1 : -1),
        event.key === 'ArrowDown' ? 1 : -1
      )
      if (nextIndex >= 0) setHighlightedIndex(nextIndex)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const nextIndex = findEnabledIndex(
        event.key === 'Home' ? 0 : options.length - 1,
        event.key === 'Home' ? 1 : -1
      )
      if (nextIndex >= 0) setHighlightedIndex(nextIndex)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectIndex(highlightedIndex)
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={`min-w-0 truncate ${selectedOption ? '' : 'text-gray-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 right-0 top-full z-[200] mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${menuClassName}`}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">暂无选项</div>
          ) : (
            options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                onClick={() => selectIndex(index)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  option.disabled
                    ? 'cursor-not-allowed text-gray-300'
                    : index === highlightedIndex
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
