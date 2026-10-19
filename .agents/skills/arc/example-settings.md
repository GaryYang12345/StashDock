# Example: account settings page

Request: "Add a settings page where people edit their profile, choose notifications, and can delete their account."

## Plan

```
Job: update profile and notification preferences, or delete the account
Primary action: Save changes
Regions: profile fields (input, select), notifications (switch rows), danger zone (confirm-morph)
States: saving (button loading), saved (button label), save error (inline alert), delete pending and done (confirm-morph)
```

Choices: `switch` because each preference applies on its own and reads as on or off; `select` for time zone (long list); `confirm-morph` instead of a dialog because the consequence fits in one line.

```bash
npx shadcn@latest add @uiarc/input @uiarc/select @uiarc/switch @uiarc/button @uiarc/alert @uiarc/confirm-morph
```

## settings-form.tsx

```tsx
"use client";

import { useId, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import { Switch } from "@/components/arc/switch/switch";
import styles from "./settings.module.css";

type Profile = { name: string; email: string; timeZone: string };
type Props = {
  initial: Profile;
  saveProfile: (profile: Profile) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const zones = [
  { value: "Europe/Zurich", label: "Zurich (UTC+1)" },
  { value: "America/New_York", label: "New York (UTC-5)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
];

const preferences = [
  { id: "mentions", title: "Mentions", description: "When someone mentions you in a comment." },
  { id: "digest", title: "Weekly summary", description: "A Monday email with last week's activity." },
];

export function SettingsForm({ initial, saveProfile, deleteAccount }: Props) {
  const id = useId();
  const [profile, setProfile] = useState(initial);
  const [notify, setNotify] = useState<Record<string, boolean>>({ mentions: true, digest: false });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = status !== "saving" && JSON.stringify(profile) !== JSON.stringify(initial);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try { await saveProfile(profile); setStatus("saved"); } catch { setStatus("error"); }
  }

  return (
    <div className={styles.stack}>
      <form className={styles.section} onSubmit={save} aria-labelledby={`${id}-profile`}>
        <h2 id={`${id}-profile`} className={styles.heading}>Profile</h2>
        <div className={styles.fields}>
          <Input label="Name" autoComplete="name" value={profile.name}
            onChange={e => { setProfile({ ...profile, name: e.target.value }); setStatus("idle"); }} />
          <Input label="Email" type="email" autoComplete="email" value={profile.email}
            description="We send receipts and sign-in codes here."
            onChange={e => { setProfile({ ...profile, email: e.target.value }); setStatus("idle"); }} />
          <Select label="Time zone" options={zones} value={profile.timeZone}
            onValueChange={timeZone => { setProfile({ ...profile, timeZone }); setStatus("idle"); }} />
        </div>
        {status === "error" && <Alert tone="danger" title="Your changes were not saved">Check your connection and try again.</Alert>}
        <div className={styles.actions}>
          <Button type="submit" loading={status === "saving"} disabled={!dirty && status !== "error"}>
            {status === "saved" ? "Saved" : "Save changes"}
          </Button>
        </div>
      </form>

      <section className={styles.section} aria-labelledby={`${id}-notify`}>
        <h2 id={`${id}-notify`} className={styles.heading}>Notifications</h2>
        <div className={styles.group}>
          {preferences.map(pref => (
            <div key={pref.id} className={styles.row}>
              <div className={styles.rowText}>
                <span id={`${id}-${pref.id}`} className={styles.rowTitle}>{pref.title}</span>
                <span id={`${id}-${pref.id}-hint`} className={styles.rowHint}>{pref.description}</span>
              </div>
              <Switch aria-labelledby={`${id}-${pref.id}`} aria-describedby={`${id}-${pref.id}-hint`}
                checked={notify[pref.id]} onCheckedChange={on => setNotify({ ...notify, [pref.id]: on })} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby={`${id}-delete`}>
        <h2 id={`${id}-delete`} className={styles.heading}>Delete account</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <p className={styles.rowHint}>Removes your profile and projects for everyone. This cannot be undone.</p>
            <ConfirmMorph label="Delete account" icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />}
              prompt="Delete your account?" confirmLabel="Delete" onConfirm={deleteAccount} />
          </div>
        </div>
      </section>
    </div>
  );
}
```

The page (`page.tsx`) is a server component: `<main className={styles.page}><h1 className={styles.title}>Settings</h1><SettingsForm ... /></main>`. This example owns the page container. If your app layout already renders one, keep only `max-width: 720px` on `.page` and drop its padding and `margin-inline`.

## settings.module.css

```css
.page { width: 100%; max-width: 720px; margin-inline: auto; padding: 32px clamp(16px, 4vw, 32px); display: grid; gap: 32px; }
.title { margin: 0; font-family: var(--font-display); font-size: var(--text-3xl); font-weight: 500; letter-spacing: var(--tracking-display); line-height: var(--leading-display); color: var(--foreground); }
.stack { display: grid; gap: 40px; }
.section { display: grid; gap: 16px; min-width: 0; }
.heading { margin: 0; font-size: var(--text-lg); font-weight: 500; color: var(--foreground); }
.fields { display: grid; gap: 16px; }
.actions { display: flex; justify-content: flex-end; }
.group { border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--surface); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; padding: 16px 24px; }
.row + .row { border-top: 1px solid var(--border-subtle); }
.rowText { display: grid; gap: 2px; min-width: 0; }
.rowTitle { font-size: var(--text-sm); font-weight: 500; color: var(--foreground); }
.rowHint { margin: 0; font-size: var(--text-sm); color: var(--text-secondary); }
@media (max-width: 560px) { .row { flex-direction: column; align-items: flex-start; } }
```

## Why it passes the checklist

- One container (720px, fluid gutters), one `h1`, one primary button; sections are plain headings with no eyebrow.
- Notification rows are one bordered group with hairline dividers, not a card per row.
- Save confirms in place ("Saved"), errors appear inline next to the action, delete confirms inline with its own pending and done states.
- Only semantic tokens; weights 400 and 500; no focus styles added.
