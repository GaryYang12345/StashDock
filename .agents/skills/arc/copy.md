# Arc copy

Arc copy is short, specific, and honest.

## Rules

1. **Sentence case everywhere**: headings, buttons, tabs, menu items, table headers, badges. Capitalize only the first word and proper nouns. Never all caps, never `text-transform: uppercase`.
2. **No eyebrow labels.** No small text above a heading ("FEATURES", "Pricing", "Why teams switch"). If the context matters, put it in the heading or the description below it. A badge beside a heading that carries information ("Recommended" on a plan name, "Beta" on a feature) is not an eyebrow; a kicker line above the heading is.
3. **No em dashes** (the long dash, U+2014). Use a period, comma, colon, or parentheses. For ranges write "9 to 17" or "Mon to Fri".
4. **No period at the end of a heading**, and no ornamental punctuation (trailing dots, slashes, arrows as decoration).
5. **Buttons are verbs with an object**: "Save changes", "Invite member", "Delete project", "Start free trial". Not "Submit", "OK", "Click here", or "Learn more" alone. A bare verb is fine only when the object is named right beside it, such as "Delete" in a confirmation that asks "Delete Harbour?".
6. **One subtitle at most**, and only when it adds information the heading cannot. Drop it when the content explains itself.
7. **Honest claims.** No invented numbers, testimonials, customer logos, or awards. Sample data is realistic and clearly sample. A simulated payment, deploy, or email says so.
8. **Consistent terms.** One word per concept across the product ("workspace" everywhere, not workspace, team, and org).

## Examples

| Incorrect | Correct |
| --- | --- |
| `<p class="eyebrow">PRICING</p><h2>Simple, Transparent Pricing.</h2>` | `<h2>Pricing that grows with your team</h2>` |
| Two clauses joined by an em dash ("Fast builds, em dash, every time") | "Builds finish in under a minute." |
| Button: "Submit" | Button: "Save changes" |
| "Oops! Something went wrong!!" | "We could not save your changes. Check your connection and try again." |
| "No data" | "No invoices yet. Your first invoice appears after the trial ends." |
| "Trusted by 10,000+ teams" (unverified) | Remove it, or state what is true: "Used by the Arc team every day" |
| Tab: "ACTIVITY LOG" | Tab: "Activity" |

## Patterns

- **Errors** say what happened and how to fix it, next to the field: "Enter an email like name@company.com".
- **Empty states** say why it is empty and offer one next step: title "No projects yet", description "Projects you create or join appear here.", action "Create project".
- **Destructive confirmations** name the object and the consequence: "Delete Harbour? Its 12 files are removed for everyone."
- **Success** is a state change in place ("Saved", a check, the new value), not a paragraph.
- **Numbers** use real formatting: "$1,240", "12.5%", "3 of 5 seats". Use tabular numerals where they change.
- **Dates** are human and unambiguous: "Sep 24", "Tomorrow at 9:00", "2 hours ago".

## Check

Search your diff for the em dash (`grep -rn "$(printf '\342\200\224')" .`), `uppercase`, `letter-spacing` on small labels, headings ending in `.`, and any text node above a heading that is smaller than the heading. Each hit is a fix.
