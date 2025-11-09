# 📘 Chapter-Based Spaced Repetition System - Waku Waku Nihongo TextBook Companion

A lightweight **SM-2–inspired** study engine (built for BJET Students primarily).  
It helps users master a **daily quota of new cards** before moving on to the next chapter — ensuring focused, incremental progress.
Default interval configurations are setup in a way to master all vocabulary in a chapter in 3-5 days, as per BJET class pace.

---

## ⚙️ Core Overview

> 🧭 Designed for studying each chapter in isolation.  
> 🎯 Focused on daily mastery.  
> 🧩 Powered by adaptive scheduling.  
> 🔁 Reinforces recall through repetition.

---

<details>
<summary><b>📚 1. Study Scope & Limits</b></summary>

### 🔹 Deck Isolation

Study sessions are strictly confined to the **currently selected chapter/deck**.  
Cards from other chapters are **never mixed** or shown during the session.

### 🔹 Daily Target

Users define a **daily limit** for introducing **new cards** (Priority 3).  
Only this many fresh cards will appear during the current session.

### 🔹 End Condition

A study session ends when all newly introduced cards reach  
`n ≥ 2` → meaning they’ve passed the `I(1) = 24h` review  
and are scheduled for `I(2) = 72h` or longer.

</details>

---

<details>
<summary><b>🧠 2. Quality Assessment & SM2 Mapping</b></summary>

The system uses a **simplified 3-button interface**,  
mapping each response to an SM-2 quality score (`q`)  
and determining the immediate scheduling action.

| **Button Input** | **Mapped Score (`q`)** | **n Action**            | **Scheduling Reset?** | **EF Change?**        |
| ---------------- | ---------------------- | ----------------------- | --------------------- | --------------------- |
| **Forgot**       | `q = 1`                | Reset → `n ← 0`         | Yes (1 minute)        | Yes (Decrease)        |
| **Confused**     | `q = 3`                | Reset → `n ← 0`         | Yes (`I(1) = 24h`)    | Yes (Slight Decrease) |
| **Remembered**   | `q = 5`                | Increment → `n ← n + 1` | No                    | Yes (Increase)        |

</details>

---

<details>
<summary><b>⏰ 3. Scheduling & Reinforcement</b></summary>

### ⏱️ Interval Unit

All intervals (`I`) are measured in **hours**, including both fixed and calculated ones.

### ⚙️ Ease Factor (EF)

- Uses the **standard SM-2 EF formula** for each quality score (`q ∈ [0, 5]`).
- EF is **bounded** to a minimum of **1.3** to prevent overly short intervals.

### 📅 Fixed Initial Intervals

- `I(1)` → **24 hours** (after the first success, `n = 1`)
- `I(2)` → **72 hours** (after the second success, `n = 2`)

### 📈 Growing Interval (`n ≥ 3`)

- `I(n) = I(n − 1) × EF` (in hours)

### 🔁 Same-Session Reinforcement

Cards rated **“Forgot” (`q = 1`)** are requeued for review **1 minute later**,  
forcing immediate repetition until successfully recalled (`q = 5`).

</details>

---

<details>
<summary><b>📋 4. Queue Priority (within Active Deck)</b></summary>

The active deck’s queue is ordered by strict priority:

| **Priority**       | **Description**         | **Condition**                    |
| ------------------ | ----------------------- | -------------------------------- |
| 🟥 **1 (Highest)** | Immediate Reinforcement | `n = 0`, failed today, due now   |
| 🟧 **2**           | Scheduled Reviews       | `n > 0`, due now                 |
| 🟩 **3 (Lowest)**  | New Cards               | Unseen cards (up to daily limit) |

</details>

---

> 💡 _“Depth before breadth — master today’s cards before moving forward.”_
