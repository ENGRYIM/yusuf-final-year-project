import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarContent } from '@/components/Sidebar'

export default function MobileNav(props) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Open menu">
          <Menu className="h-[18px] w-[18px]" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r bg-card shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:duration-300 data-[state=closed]:duration-200">
          <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Switch sections and adjust demo controls
          </Dialog.Description>
          <SidebarContent {...props} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
