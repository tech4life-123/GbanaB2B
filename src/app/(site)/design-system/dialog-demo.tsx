"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Release escrow?"
        description="Example confirmation for an irreversible action."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="escrow" onClick={() => setOpen(false)}>
              Confirm release
            </Button>
          </>
        }
      >
        Irreversible financial actions always get a confirmation step that names the amount and the recipients.
      </Dialog>
    </>
  );
}
