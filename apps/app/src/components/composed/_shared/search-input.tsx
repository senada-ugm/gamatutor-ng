import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"

const DEFAULT_DELAY_MS = 300

/**
 * Holds a value back until typing stops. Every search box in the app
 * fed its raw value straight into a TanStack Query key, so a
 * ten-character search fired ten requests and the list flickered
 * through ten result sets on the way to the one the user wanted.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  /** Accessible name — these boxes sit alone with no visible label. */
  label: string
  placeholder?: string
  className?: string
}

/** The one search box: magnifier affordance, an accessible name, and a
 *  clear button once there's something to clear. The three search
 *  surfaces (catalog, admin users) each rendered a bare Input
 *  with only a placeholder to say what it did. */
export function SearchInput({ value, onChange, label, placeholder, className }: SearchInputProps) {
  return (
    <InputGroup className={cn("max-w-sm", className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Hapus pencarian" onClick={() => onChange("")}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
