# FairShare — Product Definition

This document decides **what FairShare is for**. Every feature, screen and roadmap item should be checked against it.
If a feature doesn't make the core job faster, clearer or more trustworthy, it doesn't go in.

---

## 1. The main aim

> **When friends share costs, anyone in the group can see at a glance who owes whom, and can settle it in one tap, with no awkward conversations and no doubt about the numbers.**

The whole product is one loop:

```
Add an expense  →  See who owes whom  →  Settle up  →  Everyone is at ₹0
   (seconds)        (instant, correct)     (UPI, confirmed)
```

Everything else is secondary.

---

## 2. Who it's for and the use cases

| Use case | Example | What matters most |
|---|---|---|
| **Trips** *(primary)* | 4 friends in Goa; hotel, fuel, dinners, tickets paid by different people | Adding bills fast on a phone; one clean settle-up at the end with the fewest payments |
| **Flatmates / hostel** *(primary)* | Rent, groceries, electricity, Wi-Fi, split every month | Running balances that stay correct for months; clear history of who paid what |
| **Two people** | "I paid for your movie ticket" between two friends or a couple | Quick IOUs without creating a big group |
| **Events / office outings** | One person pays for the team lunch or a birthday gift | Split among only the people who took part |

**Not our use case:** personal budgeting, expense tracking for one person, company expense reports, group governance.

---

## 3. The USP: why use FairShare instead of Splitwise or a WhatsApp note

1. **Settle in one tap with UPI.** "Settle up" opens Google Pay, PhonePe or Paytm with the right person and exact amount already filled in. Most split apps stop at telling you the number; FairShare gets you paid.
2. **Balances everyone trusts.** A payment only counts once the receiver confirms it, every change is in the history, and the money math is exact to the paisa. Nobody can quietly erase a debt.
3. **Fast and free.** Adding an expense takes a few seconds, and there are no daily limits or paywalls on the core features. *(Splitwise's free tier now limits daily expenses.)*

One-line pitch: **"Split bills with friends in seconds, and settle with one UPI scan."**

---

## 4. What the app should show

Principles:
- **Balances first.** The first thing on every screen is the answer to "do I owe anyone, or does anyone owe me?"
- **One main action per screen**, always easy to reach (for example a big **Add expense** button).
- **Plain words:** "You owe Bala ₹333", not "net balance −333.00".
- **Mobile first.** People split bills on their phones, at the table.
- **No admin concepts.** Everyone in a group is equal. The history keeps people honest, not a boss.

### The screens (only five)

**1. Home**
- Big total at the top: *"You are owed ₹1,250"* / *"You owe ₹400"* / *"All settled up 🎉"*
- **People**: everyone you have a balance with, with the amount and a **Settle up** button
- **Groups**: each group with your balance in it
- **Add expense** button

**2. Group**
- Your balance in this group, plus a **Settle up** button showing the suggested payments (fewest payments needed)
- Members, with an **Invite** link to share on WhatsApp
- Activity: expenses and payments, newest first, grouped by month
- **Add expense** button

**3. Add expense** (one screen, a few seconds)
- Amount (large), what it was for
- **Paid by:** you by default, but can be anyone in the group
- **Split between:** everyone ticked by default; split **equally**, or by **exact amounts** or **percentages**
- It's saved as **one** expense, however it's split

**4. Settle up**
- "Pay Asha ₹333": **Pay with UPI** (QR code or deep link) → **I've paid**
- Shows as *waiting for Asha to confirm* until she confirms
- Receiver side: "Bala says he paid you ₹333 — **Confirm** / **Not received**"

**5. Activity / notifications**
- What changed and who did it: "Bala added Dinner ₹900", "Asha confirmed your payment"

Plus login, sign-up and password reset.

---

## 5. What to remove or freeze (and why)

These pull the app away from its main aim:

| Current feature | Problem | Decision |
|---|---|---|
| **Admin elections / polls** | New groups can't add any expense until someone is elected admin, which blocks the core action | **Remove.** Any member can add expenses; the group creator manages members |
| **"Mark as wrong" (admin only)** | One person decides for everyone | **Replace** with editing/deleting by the payer or the person who added it, with every change visible in History |
| **Expense disputes / voting** *(planned)* | More governance, not faster splitting | **Drop** |
| **"Delete from me" (hide entry)** | Makes one person's view differ from everyone else's, so balances look inconsistent | **Remove** |
| **Personal tracker** | A different product (personal budgeting) | **Remove** from this app |
| **Custom split creating several separate expenses** | One bill turns into many entries | **Replace** with one expense with unequal splits |
| **Payer is always the current user** | Can't record "Asha paid for the hotel", which is the most common case on a trip | **Fix**: choose any member as payer |
| **Month filter hiding older expenses** | Old unsettled expenses disappear from view | **Replace** with one list grouped by month |

Nothing is lost for the portfolio: a focused app with a polished core is a stronger resume project than many half-finished features.

---

## 6. How we'll know it works

| Goal | Measure |
|---|---|
| Adding an expense is fast | Under 10 seconds from tapping **Add expense** to saved |
| Joining is easy | A friend joins a group from an invite link in under 30 seconds |
| Balances are trusted | Settled payments confirmed by the receiver; balances always sum to ₹0 (covered by tests) |
| People actually use it | Used for at least one real trip or flat with 3+ people for a month |

---

## 7. Why this is worth putting on a resume

Recruiters and interviewers aren't impressed by the number of features. They look for:
- **A clear problem and a product that solves it well** (sections 1–4)
- **Hard engineering done right:** exact money math, debt simplification, real-time sync, a trust model for payments, security, tests, CI, a live deployment
- **Evidence it's real:** actual users and measured results

FairShare already has most of the engineering. This document makes the product equally sharp.
