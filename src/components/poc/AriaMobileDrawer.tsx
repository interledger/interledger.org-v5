import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay
} from 'react-aria-components'
import type { MenuGroup } from '@/types/navigation'

interface AriaMobileDrawerProps {
  menuGroups: MenuGroup[]
  triggerLabel?: string
}

const triggerButtonClass =
  'inline-flex items-center justify-center w-10 h-10 bg-transparent border-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:bg-gray-header'

const overlayClass =
  'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 entering:opacity-100 exiting:opacity-0 motion-reduce:transition-none'

const drawerClass =
  'fixed top-0 right-0 h-full w-[min(85vw,360px)] bg-white shadow-[-2px_0_12px_rgba(0,0,0,0.15)] outline-none flex flex-col transition-transform duration-200 entering:translate-x-0 exiting:translate-x-full motion-reduce:transition-none'

const dialogClass =
  'flex-1 flex flex-col p-space-m outline-none overflow-y-auto'

const closeButtonClass =
  'self-end bg-transparent border-0 cursor-pointer p-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:bg-gray-header'

export default function AriaMobileDrawer({
  menuGroups,
  triggerLabel = 'Open menu'
}: AriaMobileDrawerProps) {
  return (
    <DialogTrigger>
      <Button className={triggerButtonClass} aria-label={triggerLabel}>
        <span aria-hidden="true">☰</span>
      </Button>
      <ModalOverlay className={overlayClass} isDismissable>
        <Modal className={drawerClass}>
          <Dialog className={dialogClass} aria-label="Site navigation">
            {({ close }) => (
              <>
                <Button
                  slot="close"
                  className={closeButtonClass}
                  aria-label="Close menu"
                >
                  <span aria-hidden="true">✕</span>
                </Button>
                <Heading
                  slot="title"
                  className="text-step-1 mt-0 mb-space-s font-semibold"
                >
                  Menu
                </Heading>
                <nav>
                  <ul className="list-none p-0 m-0 flex flex-col gap-1">
                    {menuGroups.map((group) => (
                      <li key={group.label}>
                        {group.href && !group.items?.length ? (
                          <a
                            href={group.href}
                            onClick={() => close()}
                            className="block py-space-s px-space-2xs no-underline text-black hover:bg-gray-header"
                          >
                            {group.label}
                          </a>
                        ) : (
                          <details className="group">
                            <summary className="cursor-pointer py-space-s px-space-2xs list-none flex items-center justify-between hover:bg-gray-header">
                              <span>{group.label}</span>
                              <span
                                aria-hidden="true"
                                className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
                              >
                                ▾
                              </span>
                            </summary>
                            <ul className="list-none p-0 m-0 ps-space-s">
                              {group.items?.map((item) => (
                                <li key={item.label}>
                                  <a
                                    href={item.href ?? '#'}
                                    target={
                                      item.openInNewTab ? '_blank' : undefined
                                    }
                                    rel={
                                      item.openInNewTab
                                        ? 'noopener noreferrer'
                                        : undefined
                                    }
                                    onClick={() => close()}
                                    className="block py-space-s px-space-2xs no-underline text-black hover:bg-gray-header"
                                  >
                                    {item.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
