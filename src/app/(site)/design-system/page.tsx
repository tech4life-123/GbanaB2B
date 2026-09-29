import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, Package, Plus } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { StageTracker, TradePath } from "@/components/brand/trade-path";
import { Alert } from "@/components/ui/alert";
import { Badge, EscrowBadge, StatusDot, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { DataList, MoneyText, Table, Td, Th } from "@/components/ui/data";
import { EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { money } from "@/lib/money/currency";
import { DialogDemo } from "./dialog-demo";

export const metadata: Metadata = {
  title: "Design system",
  description: "GbanaB2B design tokens and components.",
};

const COLORS = [
  { name: "Trade Navy", hex: "#0F2027", cls: "bg-trade-900", use: "Structure, headers, primary text, secondary buttons." },
  { name: "Electric Amber", hex: "#FF9900", cls: "bg-signal-500", use: "The one primary action per screen. Always with navy text." },
  { name: "Gold", hex: "#F59E0B", cls: "bg-gold-500", use: "Earned trust and highlights. Never for actions." },
  { name: "Escrow Emerald", hex: "#10B981", cls: "bg-escrow-500", use: "Money protected, verified, confirmed. Nothing else." },
  { name: "Slate", hex: "#F8FAFC", cls: "bg-canvas border border-line", use: "App canvas." },
];

export default function DesignSystemPage() {
  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 md:py-16">
        <PageHeader
          eyebrow="Design system · v1"
          title="GbanaB2B interface kit"
          description="Tokens and components every screen is built from. Colour carries meaning here — amber acts, emerald protects, navy structures."
        />

        <Section title="Brand" id="brand">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="grid place-items-center p-8">
              <Logo showTagline />
            </Card>
            <div className="bg-manifest grid place-items-center rounded-lg p-8 shadow-card">
              <Logo tone="light" showTagline />
            </div>
            <Card className="flex items-center justify-center gap-6 p-8">
              <LogoMark className="size-16" />
              <LogoMark className="size-10" />
              <LogoMark className="size-6" />
            </Card>
          </div>
          <p className="mt-3 text-sm text-muted">
            Shield-G in gunmetal; the amber trade path loops through it; the emerald node is escrow at the centre of every
            trade. Pure SVG — no image download.
          </p>
        </Section>

        <Section title="Colour" id="colour">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {COLORS.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-lg border border-line bg-white">
                <div className={`h-20 ${c.cls}`} />
                <div className="p-3">
                  <p className="font-bold text-trade-900">{c.name}</p>
                  <p className="tabular font-mono text-xs text-muted">{c.hex}</p>
                  <p className="mt-2 text-[0.8125rem] leading-snug text-trade-700">{c.use}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" id="type">
          <Card>
            <CardBody className="space-y-4">
              <p className="text-4xl font-extrabold tracking-tight text-trade-900">Wholesale that moves.</p>
              <p className="text-2xl font-extrabold tracking-tight text-trade-900">Section heading — Archivo ExtraBold</p>
              <p className="text-base text-trade-800">
                Body copy in Archivo: sturdy, compact and legible on low-cost phone screens.
              </p>
              <p className="tabular font-mono text-base text-trade-900">GB-24-000187 · 3,736 kg · USD 12,480.00</p>
              <p className="label-caps text-muted">Label caps — waybill field names</p>
            </CardBody>
          </Card>
        </Section>

        <Section title="Buttons" id="buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={<ArrowRight className="order-last size-4" aria-hidden="true" />}>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="escrow">Release escrow</Button>
            <Button variant="danger">Reject</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />}>
              Small
            </Button>
            <Button size="md">Medium · 44px</Button>
            <Button size="lg">Large · 48px</Button>
          </div>
        </Section>

        <Section title="Forms" id="forms">
          <Card>
            <CardBody className="grid gap-5 md:grid-cols-2">
              <Field id="ds-name" label="Product title" hint="What buyers search for.">
                <Input id="ds-name" placeholder="Parboiled rice, 25 kg bag" aria-describedby={describedBy("ds-name", { hint: true })} />
              </Field>
              <Field id="ds-moq" label="Minimum order" error="MOQ must be at least 1.">
                <Input id="ds-moq" defaultValue="0" aria-invalid aria-describedby={describedBy("ds-moq", { error: true })} className="tabular font-mono" />
              </Field>
              <Field id="ds-cur" label="Currency">
                <Select id="ds-cur" defaultValue="USD">
                  <option value="USD">USD — US Dollar</option>
                  <option value="LRD">LRD — Liberian Dollar</option>
                </Select>
              </Field>
              <Field id="ds-notes" label="Handling notes" optional>
                <Textarea id="ds-notes" placeholder="Keep dry. Do not stack above 6 bags." />
              </Field>
            </CardBody>
          </Card>
        </Section>

        <Section title="Status & badges" id="status">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Draft</Badge>
            <Badge tone="info">Freight requested</Badge>
            <Badge tone="signal">Awaiting payment</Badge>
            <EscrowBadge />
            <VerifiedBadge />
            <VerifiedBadge kind="business" />
            <Badge tone="gold">Top supplier</Badge>
            <Badge tone="danger">Disputed</Badge>
            <Badge tone="navy">Admin</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <StatusDot tone="signal" pulse>
              In transit
            </StatusDot>
            <StatusDot tone="escrow">Funds held</StatusDot>
            <StatusDot tone="danger">Payment failed</StatusDot>
            <StatusDot>Pending</StatusDot>
          </div>
        </Section>

        <Section title="Alerts" id="alerts">
          <div className="grid gap-3 md:grid-cols-2">
            <Alert title="Prices locked">Your quote is held for 30 minutes.</Alert>
            <Alert tone="success" title="Payment received">Funds are now held in escrow.</Alert>
            <Alert tone="warning" title="Weak connection">We&apos;ll retry when you&apos;re back online.</Alert>
            <Alert tone="danger" title="Payment failed">Your wallet was not charged. Try again.</Alert>
          </div>
        </Section>

        <Section title="Trade path & trackers" id="flow">
          <Card>
            <CardBody className="py-8">
              <TradePath
                steps={[
                  { key: "a", title: "Ordered", detail: "Seller confirmed." },
                  { key: "b", title: "Carrier selected", detail: "Sealed bid accepted." },
                  { key: "c", title: "Escrow funded", detail: "Money held.", escrow: true },
                  { key: "d", title: "Delivered", detail: "Code confirmed." },
                ]}
              />
            </CardBody>
          </Card>
          <Card className="mt-4">
            <CardBody className="py-6">
              <StageTracker
                currentIndex={3}
                stages={[
                  { key: "1", label: "Ordered" },
                  { key: "2", label: "Freight" },
                  { key: "3", label: "Paid", escrow: true },
                  { key: "4", label: "In transit" },
                  { key: "5", label: "Delivered" },
                ]}
              />
            </CardBody>
          </Card>
        </Section>

        <Section title="Data display" id="data">
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Held in escrow" value={<MoneyText value={money(1248000, "USD")} />} tone="escrow" hint="Across 12 orders (example)" />
            <Stat label="Cargo weight" value="3,736 kg" hint="Large carrier class" />
            <Stat label="Sealed bids" value="3" hint="Closes in 41 h" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Table caption="Example price tiers">
              <thead>
                <tr>
                  <Th>Quantity</Th>
                  <Th className="text-right">Unit price</Th>
                  <Th className="text-right">You save</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1 – 49 bags", 2450, "—"],
                  ["50 – 99 bags", 2300, "6%"],
                  ["100+ bags", 2150, "12%"],
                ].map(([q, p, s]) => (
                  <tr key={String(q)}>
                    <Td>{q}</Td>
                    <Td className="text-right">
                      <MoneyText value={money(Number(p), "USD")} />
                    </Td>
                    <Td className="tabular text-right font-mono text-escrow-700">{s}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Card>
              <CardHeader title="Proforma summary" eyebrow="Example" />
              <CardBody className="py-1">
                <DataList
                  items={[
                    { label: "Subtotal", value: <MoneyText value={money(258000, "USD")} /> },
                    { label: "Freight", value: <MoneyText value={money(18500, "USD")} /> },
                    { label: "Exchange rate", value: <span className="tabular font-mono">1 USD = 192.50 LRD</span> },
                    { label: "Total", value: <MoneyText value={money(276500, "USD")} className="text-base font-bold" /> },
                  ]}
                />
              </CardBody>
              <CardFooter>
                <EscrowBadge>Paid into escrow</EscrowBadge>
              </CardFooter>
            </Card>
          </div>
          <p className="mt-3 text-sm text-muted">
            Figures on this page are illustrative component samples, not platform data.
          </p>
        </Section>

        <Section title="Empty, loading & dialogs" id="states">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState icon={<Package className="size-5" />} title="No listings yet" action={<Button size="sm">Create listing</Button>}>
              Empty states say what will appear and what to do next — never fake data.
            </EmptyState>
            <Card>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-24" />
                <div className="pt-2">
                  <DialogDemo />
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`ds-${id}`}>
      <div className="mb-5 flex items-center gap-4">
        <h2 id={`ds-${id}`} className="text-lg font-extrabold tracking-tight text-trade-900">
          {title}
        </h2>
        <span className="rule-dashed flex-1 text-line-strong" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}
