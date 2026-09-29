# Design system

Living reference: `/design-system` in the running app.

## Principles
1. **Colour is semantic.** Amber = the primary action. Emerald = money protected / verified / confirmed — nothing else. Gold = earned trust. Navy = structure. Users learn these; don't dilute them.
2. **Waybill aesthetic.** Numbers, IDs, weights and prices in tabular JetBrains Mono; field labels in small mono caps; dashed "trade path" rules and numbered stops. It should feel like logistics paperwork made digital — not a generic template.
3. **Honest states.** Empty states explain what will appear and what to do. Never fill screens with invented data.
4. **Phone first.** 44px+ touch targets, bottom tab bar in workspaces, no hover-only affordances, horizontal scroll for tables.
5. **Light.** Server-rendered, native `<details>`/`<dialog>`, SVG brand, two self-hosted variable fonts (mono not preloaded), no animation libraries, `prefers-reduced-motion` respected.

## Tokens (`src/app/globals.css`)
- `trade-50…950` (Trade Navy #0F2027 at 900), `signal-50…800` (Electric Amber #FF9900 at 500), `gold-*` (#F59E0B), `escrow-*` (#10B981), `canvas` (#F8FAFC), `ink`, `muted`, `line`, `line-strong`.
- Contrast: amber buttons use navy text (≈8.9:1). Emerald fills use navy text or `escrow-700+` for text on white.
- Utilities: `.bg-manifest` (navy ruled grid), `.label-caps`, `.rule-dashed`, `.tabular`.

## Components (`src/components`)
| Component | Notes |
| --- | --- |
| `Button`, `ButtonLink` | variants primary/secondary/outline/ghost/escrow/danger/inverse; sizes sm/md/lg; `loading` |
| `Field`, `Input`, `Select`, `Textarea`, `Label` | label/hint/error wired with `aria-describedby`/`aria-invalid` |
| `Card`, `CardHeader`, `CardBody`, `CardFooter` | |
| `Badge`, `StatusDot`, `VerifiedBadge`, `EscrowBadge` | text always carries meaning; colour reinforces |
| `Alert` | info/success/warning/danger with correct live-region role |
| `EmptyState`, `Skeleton`, `PageHeader`, `Stat` | |
| `MoneyText`, `Table`/`Th`/`Td`, `DataList` | money always shows currency code |
| `Dialog` | native `<dialog>`; focus trap and Esc for free |
| `Logo`, `LogoMark` | SVG shield-G, ribbon woven through, emerald escrow node |
| `TradePath`, `StageTracker` | signature flow motif; responsive or vertical |
