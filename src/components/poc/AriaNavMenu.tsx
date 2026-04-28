import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover
} from 'react-aria-components'
import type { MenuGroup } from '@/types/navigation'

interface AriaNavMenuProps {
  menuGroups: MenuGroup[]
}

const triggerClass =
  'inline-flex items-center whitespace-nowrap py-space-s px-space-2xs bg-transparent border-0 text-current cursor-pointer transition-colors duration-200 hover:bg-gray-header outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

const arrowIconClass =
  'inline-block w-[9px] ml-2 transition-transform duration-500 motion-reduce:transition-none'

const popoverClass =
  'bg-white border-l-2 border-gray-header shadow-[2px_3px_6px_-3px_hsla(0,0%,0%,0.06),-2px_3px_6px_-3px_hsla(0,0%,0%,0.06)] outline-none'

const menuClass = 'list-none p-0 m-0 outline-none min-w-max'

const menuItemClass =
  'block py-space-2xs px-space-2xs no-underline text-black cursor-pointer outline-none focus:bg-gray-header focus:underline focus:underline-offset-[6px] hover:bg-gray-header'

interface NavGroupProps {
  group: MenuGroup
}

// After a close (Escape, click-out, hover-out, item click), suppress hover-open
// for this many ms. Without this, the 1px overlap between trigger and popover
// causes a phantom mouseenter on the trigger when the popover unmounts → reopen.
const REOPEN_GUARD_MS = 300

function NavGroup({ group }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const liRef = useRef<HTMLLIElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const lastCloseAt = useRef(0)

  const open = () => {
    if (performance.now() - lastCloseAt.current < REOPEN_GUARD_MS) return
    setIsOpen(true)
  }

  const close = () => {
    lastCloseAt.current = performance.now()
    setIsOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) setIsOpen(true)
    else close()
  }

  // While open, track cursor at the document level using bounding-box geometry
  // (NOT element.contains). RAC's Popover portals into an empty wrapper under
  // <body>; when the cursor briefly hits that wrapper or the 1px overlap with
  // the trigger, contains() returns false and we'd close → reopen → flicker.
  // Geometry doesn't care about portal wrappers or z-order.
  useEffect(() => {
    if (!isOpen) return

    const pointInRect = (r: DOMRect, x: number, y: number) =>
      x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

    let raf: number | null = null
    const handleMove = (e: MouseEvent) => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const li = liRef.current
        const pop = popoverRef.current
        if (!li) return
        const inLi = pointInRect(
          li.getBoundingClientRect(),
          e.clientX,
          e.clientY
        )
        const inPop = pop
          ? pointInRect(pop.getBoundingClientRect(), e.clientX, e.clientY)
          : false
        if (!inLi && !inPop) close()
      })
    }

    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (
          active !== document.body &&
          !liRef.current?.contains(active) &&
          !popoverRef.current?.contains(active)
        ) {
          close()
        }
      })
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('focusin', handleFocusOut)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('focusin', handleFocusOut)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [isOpen])

  return (
    <li ref={liRef} onMouseEnter={open}>
      <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Button className={triggerClass}>
          <span>{group.label}</span>
          <img
            src="/img/arrow-menu.svg"
            alt=""
            aria-hidden="true"
            className={`${arrowIconClass} ${isOpen ? 'translate-y-[30%] rotate-180' : ''}`}
          />
        </Button>
        <Popover
          ref={popoverRef}
          className={popoverClass}
          placement="bottom start"
          offset={0}
        >
          <Menu className={menuClass}>
            {group.items!.map((item) => (
              <MenuItem
                key={item.label}
                href={item.href ?? '#'}
                target={item.openInNewTab ? '_blank' : undefined}
                rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                className={menuItemClass}
              >
                {item.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </li>
  )
}

export default function AriaNavMenu({ menuGroups }: AriaNavMenuProps) {
  return (
    <ul className="list-none p-0 m-0 flex items-center justify-center">
      {menuGroups.map((group) => {
        const hasChildren = !!group.items && group.items.length > 0
        if (!hasChildren) {
          return (
            <li key={group.label}>
              <a href={group.href ?? '#'} className={triggerClass}>
                {group.label}
              </a>
            </li>
          )
        }
        return <NavGroup key={group.label} group={group} />
      })}
    </ul>
  )
}
