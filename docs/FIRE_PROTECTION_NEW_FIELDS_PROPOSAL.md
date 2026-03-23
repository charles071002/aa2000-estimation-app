# Fire Protection Survey — New Fields Proposal

Exact field names, types, and placement for the missing fill-up questions (fire extinguisher, hose reel, fire blanket, emergency lighting, exit/evacuation).

---

## 1. Where to add them

**Step:** DETAILS (same step as Protection Area, Hazard, System Required, Sprinkler, Suppression).

**Placement in DETAILS step:**  
Add a **new section "Portable & Other Equipment"** after **"System Required"** and **before** the conditional **Sprinkler** block.

**Order in the form:**
1. Site Reference Photo  
2. PROTECTION AREA  
3. Fire hazard classification (+ Area size, Ceiling height)  
4. System Required (Suppression, Sprinkler)  
5. **NEW: Portable & Other Equipment** (see below)  
6. Conditional Sprinkler fields (if Sprinkler)  
7. Conditional Suppression fields (if Suppression)  
8. SAVE FIRE PROTECTION ENTRY  

---

## 2. New data shape (types)

Add to **`FireProtectionSurveyData`** and **`FireProtectionUnit`** in `src/types.ts`:

```ts
// Add to FireProtectionSurveyData (and mirror in FireProtectionUnit where relevant)

/** Portable fire extinguishers */
fireExtinguisher?: {
  type: 'ABC' | 'CO2' | 'Water' | 'Foam' | 'K-Class' | '';
  otherType?: string;
  quantity: number;
  capacity: '2.5 kg' | '5 kg' | '9 L' | '20 L' | 'Other' | '';
  otherCapacity?: string;
  mountingType: 'Wall-mounted' | 'Cabinet' | 'Stand' | '';
  lastServiceDate?: string;   // optional, e.g. "YYYY-MM-DD" or free text
  bfpCompliant?: boolean;
};

/** Fire hose / hose reels */
fireHoseReel?: {
  quantity: number;
  hoseLengthM: number;
  nozzleType: 'Jet' | 'Spray' | 'Jet/Spray' | 'Other' | '';
  otherNozzleType?: string;
};

/** Fire blankets */
fireBlanket?: {
  quantity: number;
  locations?: string;   // optional, e.g. "Kitchen, Lab"
};

/** Emergency lighting */
emergencyLighting?: {
  present: boolean;
  type?: 'Maintained' | 'Non-maintained' | '';
};

/** Exit / evacuation (optional) */
exitEvacuation?: {
  exitSignsQuantity: number;
  evacuationLightingPresent: boolean;
};
```

---

## 3. Exact field names and UI labels

### 3.1 Fire Extinguisher (portable)

| Data path | UI label | Control |
|-----------|----------|--------|
| `fireExtinguisher.type` | Extinguisher Type | Buttons: ABC, CO2, Water, Foam, K-Class, Other |
| `fireExtinguisher.otherType` | Specify Type | Text input (when Other) |
| `fireExtinguisher.quantity` | Quantity | Number input |
| `fireExtinguisher.capacity` | Capacity | Buttons: 2.5 kg, 5 kg, 9 L, 20 L, Other |
| `fireExtinguisher.otherCapacity` | Specify Capacity | Text input (when Other) |
| `fireExtinguisher.mountingType` | Mounting | Buttons: Wall-mounted, Cabinet, Stand |
| `fireExtinguisher.lastServiceDate` | Last Service Date (optional) | Text or date input |
| `fireExtinguisher.bfpCompliant` | BFP Compliant? | Buttons: Yes, No |

### 3.2 Fire Hose / Hose Reel

| Data path | UI label | Control |
|-----------|----------|--------|
| `fireHoseReel.quantity` | Hose Reel Quantity | Number input |
| `fireHoseReel.hoseLengthM` | Hose Length (m) | Number input |
| `fireHoseReel.nozzleType` | Nozzle Type | Buttons: Jet, Spray, Jet/Spray, Other |
| `fireHoseReel.otherNozzleType` | Specify Nozzle Type | Text input (when Other) |

### 3.3 Fire Blanket

| Data path | UI label | Control |
|-----------|----------|--------|
| `fireBlanket.quantity` | Fire Blanket Quantity | Number input |
| `fireBlanket.locations` | Locations (optional) | Text input, placeholder e.g. "e.g. Kitchen, Lab" |

### 3.4 Emergency Lighting

| Data path | UI label | Control |
|-----------|----------|--------|
| `emergencyLighting.present` | Emergency Lighting Present? | Buttons: Yes, No |
| `emergencyLighting.type` | Type (if Yes) | Buttons: Maintained, Non-maintained |

### 3.5 Exit / Evacuation

| Data path | UI label | Control |
|-----------|----------|--------|
| `exitEvacuation.exitSignsQuantity` | Exit Signs Quantity | Number input |
| `exitEvacuation.evacuationLightingPresent` | Evacuation Lighting Present? | Buttons: Yes, No |

---

## 4. Section header in UI

- **Section title:** `Portable & Other Equipment`  
- **Sub-heading (optional):** e.g. "Fire Extinguisher, Hose Reel, Fire Blanket, Emergency Lighting, Exit/Evacuation"

---

## 5. Where in code to add

| Item | File | Location |
|------|------|----------|
| Type definitions | `src/types.ts` | In `FireProtectionSurveyData` add `fireExtinguisher?`, `fireHoseReel?`, `fireBlanket?`, `emergencyLighting?`, `exitEvacuation?`. In `FireProtectionUnit` add the same optional fields (so each saved unit can store them). |
| Initial state | `src/components/FireProtectionSurvey.tsx` | In the `useState<FireProtectionSurveyData>` default, add empty defaults for the new objects. |
| UI section | `src/components/FireProtectionSurvey.tsx` | In the DETAILS step JSX, after the "System Required" block (after the `{['Suppression', 'Sprinkler'].map(...)}` block), before `{data.scope.systems.includes('Sprinkler') && (...)}`, insert a new `<div>` for "Portable & Other Equipment" with the fields above. |
| Save/copy/load unit | `src/components/FireProtectionSurvey.tsx` | In `snapshotCurrentUnit`, `loadUnitIntoForm`, and when creating a new unit from current form, read/write the new fields so they are stored per protection unit. |
| SurveySummary / audit detail | `src/components/SurveySummary.tsx` | In Fire Protection audit detail (e.g. `renderAuditDetails` for Fire Protection), optionally display the new sections (Fire Extinguisher, Hose Reel, Fire Blanket, Emergency Lighting, Exit/Evacuation) from the selected unit or from `data`. |

---

## 6. Summary

- **New section:** "Portable & Other Equipment" in **DETAILS** step, **after** System Required, **before** Sprinkler/Suppression blocks.
- **New fields:**  
  `fireExtinguisher`, `fireHoseReel`, `fireBlanket`, `emergencyLighting`, `exitEvacuation` with the exact property names and types above.
- **Per-unit:** Add the same optional fields to `FireProtectionUnit` and sync them in save/copy/load so each fire protection entry can have its own portable equipment data.

This gives you exact field names and where to add them in the Fire Protection survey and types.
