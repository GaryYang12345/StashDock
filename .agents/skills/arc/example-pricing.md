# Example: pricing section

Request: "Add a pricing section with three plans, monthly and yearly billing, a feature comparison, and an FAQ."

## Plan

```
Job: pick a plan and understand what the price includes
Primary action: one per plan card; the recommended plan's button is the only primary
Regions: heading, billing-toggle, three plan cards with BillingPrice, comparison-table, faq-section
States: prices roll when billing changes (BillingPrice), the table can hide identical rows and stacks on phones
```

Choices: `billing-toggle` rather than `segmented-control` (it carries the savings badge and pairs with `BillingPrice`); `comparison-table` with your plans as columns rather than `plan-comparison` (a fixed two-plan demo); `faq-section` with props.

```bash
npx shadcn@latest add @uiarc/billing-toggle @uiarc/button @uiarc/badge @uiarc/comparison-table @uiarc/faq-section
```

## pricing.tsx

```tsx
"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { BillingPrice, BillingToggle } from "@/components/arc/billing-toggle/billing-toggle";
import { Button } from "@/components/arc/button/button";
import { ComparisonTable, type ComparisonSection } from "@/components/arc/blocks/comparison-table/comparison-table";
import { FaqSection } from "@/components/arc/blocks/faq-section/faq-section";
import styles from "./pricing.module.css";

const plans = [
  { id: "starter", name: "Starter", monthly: 0, yearly: 0, blurb: "For one person trying things out.", cta: "Start free", points: ["3 projects", "Community support"] },
  { id: "team", name: "Team", monthly: 24, yearly: 19, blurb: "For small teams shipping together.", cta: "Start 14-day trial", points: ["Unlimited projects", "Shared workspaces", "Email support"], recommended: true },
  { id: "business", name: "Business", monthly: 49, yearly: 39, blurb: "For companies with review and security needs.", cta: "Talk to sales", points: ["Everything in Team", "SSO and audit log", "Priority support"] },
];

const sections: ComparisonSection[] = [
  { id: "core", title: "Core", rows: [
    { id: "projects", feature: "Projects", values: { starter: "3", team: "Unlimited", business: "Unlimited" } },
    { id: "history", feature: "Version history", values: { starter: "7 days", team: "90 days", business: "Unlimited" } },
  ] },
  { id: "security", title: "Security", rows: [
    { id: "sso", feature: "Single sign-on", values: { starter: false, team: false, business: true } },
    { id: "audit", feature: "Audit log", values: { starter: false, team: false, business: true } },
  ] },
];

const faq = [
  { question: "Can I switch plans later?", answer: "Yes. Upgrades apply right away and downgrades at the end of the billing period." },
  { question: "What happens after the trial?", answer: "You choose a plan or stay on Starter. Nothing is charged without your confirmation." },
];

export function Pricing({ onChoose }: { onChoose: (planId: string, period: string) => void }) {
  const id = useId();
  const [period, setPeriod] = useState("yearly");
  const yearly = period === "yearly";

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>Pricing that grows with your team</h2>
        <p className={styles.lede}>Start free. Upgrade when you invite your first teammate.</p>
        <BillingToggle value={period} onValueChange={setPeriod} />
      </header>

      <ul className={styles.plans}>
        {plans.map(plan => (
          <li key={plan.id} className={styles.plan} data-recommended={plan.recommended || undefined}>
            <div className={styles.planHead}>
              <h3 className={styles.planName}>{plan.name}</h3>
              {plan.recommended && <Badge tone="info" size="sm">Recommended</Badge>}
            </div>
            <BillingPrice amount={yearly ? plan.yearly : plan.monthly} was={yearly && plan.monthly > plan.yearly ? plan.monthly : undefined}
              period={plan.monthly === 0 ? "forever" : yearly ? "per seat per month, billed yearly" : "per seat per month"} />
            <p className={styles.blurb}>{plan.blurb}</p>
            <ul className={styles.points}>
              {plan.points.map(point => <li key={point}><Check size={16} strokeWidth={1.75} aria-hidden="true" />{point}</li>)}
            </ul>
            <Button variant={plan.recommended ? "primary" : "secondary"} className={styles.cta} onClick={() => onChoose(plan.id, period)}>{plan.cta}</Button>
          </li>
        ))}
      </ul>

      <ComparisonTable title="Compare plans" description="What each plan includes."
        columns={plans.map(({ id, name, recommended }) => ({ id, name, highlight: recommended }))} sections={sections} stickyTop={64} />
      <FaqSection title="Questions about billing" items={faq} contact={{ label: "Talk to billing", href: "mailto:billing@example.com" }} />
    </section>
  );
}
```

## pricing.module.css

```css
.section { display: grid; gap: 64px; padding-block: clamp(64px, 10vw, 120px); }
.header { display: grid; justify-items: center; gap: 16px; text-align: center; }
.title { margin: 0; font-family: var(--font-display); font-size: clamp(var(--text-3xl), 5vw, var(--text-4xl)); font-weight: 500; letter-spacing: var(--tracking-display); line-height: var(--leading-display); color: var(--foreground); text-wrap: balance; }
.lede { margin: 0; max-width: 48ch; font-size: var(--text-lg); color: var(--text-secondary); }
.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; align-items: stretch; }
.plan { display: flex; flex-direction: column; gap: 16px; padding: 24px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--surface); min-width: 0; }
.plan[data-recommended] { border-color: var(--border-strong); }
.planHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.planName { margin: 0; font-size: var(--text-lg); font-weight: 500; color: var(--foreground); }
.blurb { margin: 0; font-size: var(--text-sm); color: var(--text-secondary); }
.points { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); color: var(--foreground); }
.points li { display: flex; align-items: center; gap: 8px; }
.points svg { color: var(--text-secondary); flex: none; }
.cta { margin-top: auto; width: 100%; }
```

`onChoose` starts checkout or opens sign up; the buttons act, so they are buttons. A CTA that only navigates is a link (`<a>` styled in your module, or a block action with `href`).

Place `<Pricing onChoose={...} />` inside the page's one container; the section adds vertical rhythm only, no gutters or max width of its own.

## Why it passes the checklist

- No eyebrow above the heading, sentence case, no em dashes, prices roll with tabular numerals (`BillingPrice`).
- Cards are siblings with equal height and a 16px gap; the buttons align at the bottom (`margin-top: auto`).
- Accent appears only on the recommended badge, the selected billing option, and the recommended plan's column in the table. No gradient on the cards.
- One primary button (the recommended plan). Claims are about the product, not invented social proof.
- Optional premium touch: the recommended card may use the metallic treatment from design.md instead of `--border-strong`, but only one card.
