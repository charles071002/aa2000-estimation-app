# Fire Protection Survey — Alarm Core / Detectors: Where to Put It & Fill-Up Questions

## 1. Where to put it

**Step:** **DETAILS** (same step as Protection Area, Hazard, Ceiling type/height, System Required, Portable & Other Equipment, Sprinkler, Suppression).

**Placement in the DETAILS step:**  
Add a new section **"Alarm core / detectors"** (or **"Fire alarm panel & detectors"**) **after "System Required"** and **before "Portable & Other Equipment"**.

**Order in the form (DETAILS step):**
1. Site Reference Photo  
2. Protection Area  
3. Scope Status  
4. Fire hazard classification → Area size, Ceiling type, Ceiling height  
5. System Required (Suppression, Sprinkler, Portable & Other Equipment)  
6. **NEW: Alarm core / detectors** (see below)  
7. Portable & Other Equipment (when "Portable" is selected)  
8. Conditional Sprinkler fields (when "Sprinkler" is selected)  
9. Conditional Suppression fields (when "Suppression" is selected)  
10. SAVE FIRE PROTECTION ENTRY  

**Why here:**  
- Alarm core (panel type, location, detector counts) is part of the **unit-level** details and is already stored in `alarmCore` and in each saved unit.  
- Putting it after System Required keeps the flow: “what systems” → “fire alarm panel & detector counts” → “portable equipment” → “sprinkler/suppression details.”  
- It stays in DETAILS so it is saved with each Fire Protection unit (Copy/Edit will include it).

---

## 2. Fill-up questions (exact labels and controls)

The data already exists in `FireProtectionSurveyData.alarmCore`. Add UI that reads/writes these fields.

| # | Data path | UI label | Control type | Notes |
|---|-----------|----------|--------------|--------|
| 1 | `alarmCore.type` | **Panel type** | Buttons: **Addressable** \| **Conventional** | 1 row, 2 columns. Same style as other option groups. |
| 2 | `alarmCore.panelLocation` | **Panel location** | Text input (with voice icon) | Single line; e.g. "Control room", "Ground floor lobby". |
| 3 | `alarmCore.powerAvailable` | **Dedicated power available?** | Buttons: **Yes** \| **No** | Optional (can be left unset). 1 row, 2 columns. |
| 4 | `alarmCore.batteryRequired` | **Backup battery required?** | Buttons: **Yes** \| **No** | Optional. 1 row, 2 columns. |
| 5 | `alarmCore.smokeCount` | **Smoke detector quantity** | Number input (min 0), with voice icon | Integer. |
| 6 | `alarmCore.heatCount` | **Heat detector quantity** | Number input (min 0), with voice icon | Integer. |
| 7 | `alarmCore.mcpCount` | **Manual call point (MCP) quantity** | Number input (min 0), with voice icon | Integer. |
| 8 | `alarmCore.notifCount` | **Notification appliance quantity** | Number input (min 0), with voice icon | Horns, strobes, sounders, etc. |

**Section header in UI:**  
- **"Alarm core / detectors"** or **"Fire alarm panel & detectors"** (same style as "System Required" / "Fire hazard classification": uppercase, blue or red accent, spacing above/below).

**Layout suggestions:**  
- Panel type and two yes/no questions: each on its own row with label + buttons.  
- Panel location: full-width text input.  
- The four quantities (smoke, heat, MCP, notification): either 4 separate rows, or 2×2 grid (e.g. Smoke and Heat on one row, MCP and Notif on the next), each with a small number input. Use the same input style as Area size / Ceiling height (rounded, with mic icon).

---

## 3. Summary

- **Where:** DETAILS step, **after "System Required"**, **before "Portable & Other Equipment"**.  
- **What:** One new section with 8 fill-up items: Panel type, Panel location, Power available?, Battery required?, Smoke count, Heat count, MCP count, Notification count.  
- **Data:** All map to existing `data.alarmCore`; no type changes needed. Save/Copy/Edit already persist `alarmCore` per unit.

If you want, the next step is to implement this section in `FireProtectionSurvey.tsx` with the exact labels and controls above.
