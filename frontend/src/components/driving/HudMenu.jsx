import { useEffect, useRef, useState } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'

// The driving HUD's "More" menu: the controls a learner reaches for rarely
// (wheel setup, reset camera) and the authoring tools, out of the top bar so
// it stays one row.
//
// Each item is { id, label, icon, onSelect, checked }. An item with a boolean
// `checked` is a toggle (menuitemcheckbox). The menu works from the keyboard
// (arrows, Home/End, Escape, Tab), and swallows the keys it handles: the
// driving keyboard source listens on window, where Space is the parking brake
// and the arrows move the camera.
const MENU_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Enter', ' ']

export function HudMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])

  const close = (refocus) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  // Opening moves focus into the menu; a click anywhere else closes it.
  useEffect(() => {
    if (!open) return undefined
    itemRefs.current[0]?.focus()
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (!MENU_KEYS.includes(event.key)) return
    event.stopPropagation()
    if (event.key === 'Enter' || event.key === ' ') return
    event.preventDefault()
    if (event.key === 'Escape') {
      close(true)
      return
    }
    const elements = itemRefs.current.filter(Boolean)
    const index = elements.indexOf(document.activeElement)
    const next = {
      ArrowDown: (index + 1) % elements.length,
      ArrowUp: (index - 1 + elements.length) % elements.length,
      Home: 0,
      End: elements.length - 1,
    }[event.key]
    elements[next]?.focus()
  }

  if (!items.length) return null

  return (
    <div className="driving-hud-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`driving-reset-button driving-icon-button ${open ? 'is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="driving-hud-menu-list" role="menu" aria-label={label} onKeyDown={handleMenuKeyDown}>
          {items.map(({ id, label: itemLabel, icon: Icon, onSelect, checked }, index) => {
            const toggle = typeof checked === 'boolean'
            return (
              <button
                key={id}
                ref={(element) => {
                  itemRefs.current[index] = element
                }}
                type="button"
                role={toggle ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={toggle ? checked : undefined}
                tabIndex={-1}
                className="driving-hud-menu-item"
                onClick={() => {
                  onSelect()
                  close(true)
                }}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                <span>{itemLabel}</span>
                {toggle && checked && <Check size={14} aria-hidden="true" className="driving-hud-menu-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
