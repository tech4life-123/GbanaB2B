"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Browser print dialog — "Save as PDF" is built in on phones and desktops, so no PDF library is shipped. */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>
      Print or save PDF
    </Button>
  );
}
