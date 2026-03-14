import { useEffect, useMemo, useState } from "react"
import { Gem, Moon, Shield, Sun, Swords, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ItemTrack = "Adventurer" | "Veteran" | "Champion"
type PlannedUpgrade = "Keep Current" | "243 Veteran" | "246 Champion" | "246 Unupgradable"
type ThemeMode = "light" | "dark"
type GearTrack = ItemTrack | ""

type GearEntry = {
  slot: string
  itemLevel: string
  track: GearTrack
}

type ResultGearEntry = Omit<GearEntry, "track"> & {
  track: string
  upgraded: boolean
  discountedChampionToVeteran?: boolean
  note?: string
}

type CrestResultGearEntry = ResultGearEntry & {
  crestNote?: string
}

type CrestCalculationResult = {
  gear: CrestResultGearEntry[]
  crestsSpent: number
  crestsRemaining: number
}

type SlotOverride = {
  enabled: boolean
  crestCost: string
}

const GEAR_SLOTS = [
  "Head",
  "Neck",
  "Shoulders",
  "Back",
  "Chest",
  "Wrist",
  "Hands",
  "Waist",
  "Legs",
  "Feet",
  "Ring 1",
  "Ring 2",
  "Trinket 1",
  "Trinket 2",
  "Main Hand",
  "Off Hand",
]

const TRACK_OPTIONS: ItemTrack[] = ["Adventurer", "Veteran", "Champion"]
const PVP_UPGRADE_BUTTON_OPTIONS: PlannedUpgrade[] = [
  "Keep Current",
  "243 Veteran",
  "246 Champion",
  "246 Unupgradable",
]

const PVP_UPGRADE_OPTION_META: Record<PlannedUpgrade, {
  heading: string
  buttonLabel: string
  selectedLabel: string
  selectedClass: string
  unselectedClass: string
}> = {
  "Keep Current": {
    heading: "None",
    buttonLabel: "No PvP Upgrade",
    selectedLabel: "Selected: None",
    selectedClass: "border-slate-700 bg-slate-600 text-white ring-2 ring-slate-300 shadow-sm shadow-slate-500/40 hover:bg-slate-600 dark:border-slate-400 dark:ring-slate-700",
    unselectedClass: "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/20",
  },
  "243 Veteran": {
    heading: "Bloody Tokens",
    buttonLabel: "Upgrade to 243 Veteran",
    selectedLabel: "Selected: 243 Veteran",
    selectedClass: "border-emerald-700 bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-sm shadow-emerald-500/40 hover:bg-emerald-600 dark:border-emerald-400 dark:ring-emerald-700",
    unselectedClass: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20",
  },
  "246 Champion": {
    heading: "Conquest",
    buttonLabel: "Upgrade to 246 Champion",
    selectedLabel: "Selected: 246 Champion",
    selectedClass: "border-blue-700 bg-blue-600 text-white ring-2 ring-blue-300 shadow-sm shadow-blue-500/40 hover:bg-blue-600 dark:border-blue-400 dark:ring-blue-700",
    unselectedClass: "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20",
  },
  "246 Unupgradable": {
    heading: "Heraldry",
    buttonLabel: "Set to 246 Crafted",
    selectedLabel: "Selected: 246 Crafted",
    selectedClass: "border-violet-700 bg-violet-600 text-white ring-2 ring-violet-300 shadow-sm shadow-violet-500/40 hover:bg-violet-600 dark:border-violet-400 dark:ring-violet-700",
    unselectedClass: "border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/20",
  },
}

const SIMC_SLOT_TO_APP_SLOT: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  shoulder: "Shoulders",
  back: "Back",
  chest: "Chest",
  wrist: "Wrist",
  hands: "Hands",
  waist: "Waist",
  legs: "Legs",
  feet: "Feet",
  finger1: "Ring 1",
  finger2: "Ring 2",
  trinket1: "Trinket 1",
  trinket2: "Trinket 2",
  main_hand: "Main Hand",
  off_hand: "Off Hand",
}

const STORAGE_KEY = "wow-s1-vet-use:planner-state"

const TRACK_LEVELS: Record<ItemTrack, number[]> = {
  Adventurer: [220, 224, 227, 230, 233, 237],
  Veteran: [233, 237, 240, 243, 246, 250],
  Champion: [246, 250, 253, 256, 259, 263],
}

// Heuristic hints inferred from user-provided Midnight S1 sample.
const TRACK_BONUS_ID_HINTS: Record<ItemTrack, number[]> = {
  Adventurer: [12774],
  Veteran: [12779, 12781],
  Champion: [12785],
}

const STEP_META = [
  {
    id: 1,
    label: "Current Gear",
    detail: "Enter item level and track",
    icon: Shield,
  },
  {
    id: 2,
    label: "PvP Upgrades",
    detail: "Select each PvP outcome",
    icon: Swords,
  },
  {
    id: 3,
    label: "Confirm Gear",
    detail: "Review and confirm result",
    icon: Trophy,
  },
  {
    id: 4,
    label: "Veteran Crest Use",
    detail: "Apply crest usage",
    icon: Gem,
  },
] as const

function getDefaultTheme(): ThemeMode {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark"
  }

  return "light"
}

function getDefaultGear(): GearEntry[] {
  return GEAR_SLOTS.map((slot) => ({
    slot,
    itemLevel: "",
    track: "",
  }))
}

function getDefaultUpgradePlan(): Record<string, PlannedUpgrade> {
  return GEAR_SLOTS.reduce<Record<string, PlannedUpgrade>>((acc, slot) => {
    acc[slot] = "Keep Current"
    return acc
  }, {})
}

function getDefaultSlotOverrides(): Record<string, SlotOverride> {
  return GEAR_SLOTS.reduce<Record<string, SlotOverride>>((acc, slot) => {
    acc[slot] = {
      enabled: false,
      crestCost: "",
    }
    return acc
  }, {})
}

function isItemTrack(value: unknown): value is ItemTrack {
  return value === "Adventurer" || value === "Veteran" || value === "Champion"
}

function isGearTrack(value: unknown): value is GearTrack {
  return value === "" || isItemTrack(value)
}

function isPlannedUpgrade(value: unknown): value is PlannedUpgrade {
  return value === "Keep Current"
    || value === "243 Veteran"
    || value === "246 Champion"
    || value === "246 Unupgradable"
}

function hydrateGear(raw: unknown): GearEntry[] {
  const fallback = getDefaultGear()

  if (!Array.isArray(raw)) {
    return fallback
  }

  const bySlot = new Map(
    raw
      .filter((entry): entry is { slot: unknown; itemLevel: unknown; track: unknown } =>
        typeof entry === "object" && entry !== null,
      )
      .map((entry) => [String(entry.slot), entry]),
  )

  return fallback.map((base) => {
    const saved = bySlot.get(base.slot)

    if (!saved) {
      return base
    }

    return {
      slot: base.slot,
      itemLevel: typeof saved.itemLevel === "string" ? saved.itemLevel : "",
      track: isGearTrack(saved.track) ? saved.track : "",
    }
  })
}

function hydrateUpgradePlan(raw: unknown): Record<string, PlannedUpgrade> {
  const fallback = getDefaultUpgradePlan()

  if (typeof raw !== "object" || raw === null) {
    return fallback
  }

  const saved = raw as Record<string, unknown>

  return GEAR_SLOTS.reduce<Record<string, PlannedUpgrade>>((acc, slot) => {
    const candidate = saved[slot]
    acc[slot] = isPlannedUpgrade(candidate) ? candidate : "Keep Current"
    return acc
  }, {})
}

function hydrateSlotOverrides(raw: unknown): Record<string, SlotOverride> {
  const fallback = getDefaultSlotOverrides()

  if (typeof raw !== "object" || raw === null) {
    return fallback
  }

  const saved = raw as Record<string, unknown>

  return GEAR_SLOTS.reduce<Record<string, SlotOverride>>((acc, slot) => {
    const candidate = saved[slot]

    if (typeof candidate !== "object" || candidate === null) {
      acc[slot] = fallback[slot]
      return acc
    }

    const typedCandidate = candidate as {
      enabled?: unknown
      crestCost?: unknown
    }

    acc[slot] = {
      enabled: typeof typedCandidate.enabled === "boolean" ? typedCandidate.enabled : false,
      crestCost: typeof typedCandidate.crestCost === "string" ? typedCandidate.crestCost : "",
    }
    return acc
  }, {})
}

function loadPersistedState() {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      step?: unknown
      confirmed?: unknown
      theme?: unknown
      gear?: unknown
      upgradePlan?: unknown
      usingTwoHandedWeapon?: unknown
      veteranCrests?: unknown
      prioritizeTrinketsEarly?: unknown
      slotOverrides?: unknown
    }

    const step = typeof parsed.step === "number"
      ? Math.min(Math.max(Math.trunc(parsed.step), 1), STEP_META.length)
      : 1

    return {
      step,
      confirmed: typeof parsed.confirmed === "boolean" ? parsed.confirmed : false,
      theme: parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : getDefaultTheme(),
      gear: hydrateGear(parsed.gear),
      upgradePlan: hydrateUpgradePlan(parsed.upgradePlan),
      usingTwoHandedWeapon: typeof parsed.usingTwoHandedWeapon === "boolean" ? parsed.usingTwoHandedWeapon : false,
      veteranCrests: typeof parsed.veteranCrests === "string" ? parsed.veteranCrests : "",
      prioritizeTrinketsEarly: typeof parsed.prioritizeTrinketsEarly === "boolean" ? parsed.prioritizeTrinketsEarly : false,
      slotOverrides: hydrateSlotOverrides(parsed.slotOverrides),
    }
  } catch {
    return null
  }
}

function isRequiredSlot(slot: string, usingTwoHandedWeapon: boolean) {
  if (slot === "Off Hand" && usingTwoHandedWeapon) {
    return false
  }

  return true
}

function parseItemLevel(itemLevel: string) {
  const parsed = Number(itemLevel)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function computeOverallItemLevel(
  gear: Array<{ slot: string; itemLevel: string }>,
  usingTwoHandedWeapon: boolean,
) {
  let total = 0
  let count = 0

  const mainHand = gear.find((entry) => entry.slot === "Main Hand")
  const mainHandLevel = mainHand ? parseItemLevel(mainHand.itemLevel) : null

  for (const item of gear) {
    if (item.slot === "Off Hand" && usingTwoHandedWeapon) {
      continue
    }

    const parsed = parseItemLevel(item.itemLevel)
    if (parsed === null) {
      return null
    }

    total += parsed
    count += 1
  }

  // WoW treats a 2H main hand as occupying both weapon slots for average ilvl.
  if (usingTwoHandedWeapon) {
    if (mainHandLevel === null) {
      return null
    }

    total += mainHandLevel
    count += 1
  }

  if (count === 0) {
    return null
  }

  return total / count
}

function getOriginalItemSummary(item: GearEntry) {
  const originalIlvl = item.itemLevel.trim().length > 0 ? item.itemLevel : "--"
  const originalTrack = item.track || "Unset"

  return `${originalIlvl} ${originalTrack}`
}

function applyUpgrade(item: GearEntry, planned: PlannedUpgrade): ResultGearEntry {
  const currentLevel = Number(item.itemLevel)
  const originalSummary = getOriginalItemSummary(item)

  if (planned === "243 Veteran") {
    return {
      ...item,
      itemLevel: "243",
      track: "Veteran",
      upgraded: true,
      note: `PvP upgrade applied: ${originalSummary} -> 243 Veteran.`,
    }
  }

  if (planned === "246 Champion") {
    if (item.track === "Veteran") {
      return {
        ...item,
        itemLevel: "246",
        track: "Veteran",
        upgraded: true,
        discountedChampionToVeteran: true,
        note: `Conquest selected: ${originalSummary} -> 246 Veteran (discounted from Champion due to existing Veteran).`,
      }
    }

    return {
      ...item,
      itemLevel: "246",
      track: "Champion",
      upgraded: true,
      note: `PvP upgrade applied: ${originalSummary} -> 246 Champion.`,
    }
  }

  if (planned === "246 Unupgradable") {
    return {
      ...item,
      itemLevel: "246",
      track: "Unupgradable",
      upgraded: true,
      note: `PvP upgrade applied: ${originalSummary} -> 246 Crafted.`,
    }
  }

  return {
    ...item,
    itemLevel: Number.isFinite(currentLevel) ? String(currentLevel) : item.itemLevel,
    upgraded: false,
  }
}

function getTrackState(itemLevel: string, track: GearTrack) {
  if (itemLevel.trim().length === 0) {
    return null
  }

  if (!track) {
    return null
  }

  const parsed = Number(itemLevel)

  if (!Number.isFinite(parsed)) {
    return null
  }

  const tierIndex = TRACK_LEVELS[track].findIndex((level) => level === parsed)

  if (tierIndex === -1) {
    return {
      label: "Invalid",
      isValid: false,
    }
  }

  return {
    label: `${track} ${tierIndex + 1}/6`,
    isValid: true,
  }
}

function getTrackStateClasses(track: GearTrack, isValid: boolean) {
  if (!isValid) {
    return "border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
  }

  if (track === "Champion") {
    return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
  }

  if (track === "Veteran") {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200"
}

function parseSimcEquippedItems(simcText: string) {
  const section = simcText.split(/\n### Gear from Bags/)[0]
  const lines = section.split(/\r?\n/)
  const itemsBySlot: Record<string, { itemLevel: string; bonusIds: number[] }> = {}

  let pendingItemLevel: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.length === 0) {
      pendingItemLevel = null
      continue
    }

    const itemCommentMatch = line.match(/^# .*\((\d+)\)\s*$/)
    if (itemCommentMatch) {
      pendingItemLevel = itemCommentMatch[1]
      continue
    }

    const equippedMatch = line.match(/^([a-z0-9_]+)=,/)
    if (equippedMatch) {
      const simcSlot = equippedMatch[1]
      const appSlot = SIMC_SLOT_TO_APP_SLOT[simcSlot]
      const bonusMatch = line.match(/bonus_id=([0-9/]+)/)
      const bonusIds = bonusMatch
        ? bonusMatch[1]
          .split("/")
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
        : []

      if (appSlot && pendingItemLevel) {
        itemsBySlot[appSlot] = {
          itemLevel: pendingItemLevel,
          bonusIds,
        }
      }

      pendingItemLevel = null
      continue
    }

    pendingItemLevel = null
  }

  return itemsBySlot
}

function inferTrackFromBonusIds(bonusIds: number[]): ItemTrack | null {
  const matches = TRACK_OPTIONS.filter((track) =>
    bonusIds.some((bonusId) => TRACK_BONUS_ID_HINTS[track].includes(bonusId)),
  )

  if (matches.length !== 1) {
    return null
  }

  return matches[0]
}

function getResultTrackStateLabel(item: { itemLevel: string; track: string }) {
  if (item.track === "Unupgradable") {
    return "Crafted"
  }

  const state = getTrackState(item.itemLevel, item.track as GearTrack)
  if (!state) {
    return "Unset"
  }

  return state.label
}

function getResultTrackStateClasses(item: { itemLevel: string; track: string }) {
  if (item.track === "Unupgradable") {
    return "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
  }

  const state = getTrackState(item.itemLevel, item.track as GearTrack)
  if (!state) {
    return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200"
  }

  return getTrackStateClasses(item.track as GearTrack, state.isValid)
}

function inferTrackFromItemLevel(itemLevel: string): ItemTrack | null {
  const parsed = Number(itemLevel)

  if (!Number.isFinite(parsed)) {
    return null
  }

  const matchingTracks = TRACK_OPTIONS.filter((track) => TRACK_LEVELS[track].includes(parsed))

  if (matchingTracks.length !== 1) {
    return null
  }

  return matchingTracks[0]
}

function formatItemLevel(value: number | null) {
  if (value === null) {
    return "--"
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getVeteranTier(itemLevel: string) {
  const parsed = Number(itemLevel)

  if (!Number.isFinite(parsed)) {
    return null
  }

  const index = TRACK_LEVELS.Veteran.findIndex((level) => level === parsed)
  if (index === -1) {
    return null
  }

  return index + 1
}

function getCrestUpgradePriority(slot: string, prioritizeTrinketsEarly: boolean) {
  if (slot === "Main Hand" || slot === "Off Hand") {
    return 1
  }

  if (slot === "Trinket 1" || slot === "Trinket 2") {
    return prioritizeTrinketsEarly ? 2 : 4
  }

  if (slot === "Head" || slot === "Chest" || slot === "Legs") {
    return 3
  }

  if (slot === "Shoulders" || slot === "Hands" || slot === "Waist" || slot === "Feet") {
    return 5
  }

  if (slot === "Wrist") {
    return 7
  }

  return 6
}

function calculateVeteranCrestUpgrades(
  gear: ResultGearEntry[],
  veteranCrests: string,
  prioritizeTrinketsEarly: boolean,
  usingTwoHandedWeapon: boolean,
  slotOverrides: Record<string, SlotOverride>,
): CrestCalculationResult {
  const availableCrests = Math.max(0, Math.trunc(Number(veteranCrests) || 0))
  let crestsRemaining = availableCrests

  const workingGear: CrestResultGearEntry[] = gear.map((item) => ({ ...item, crestNote: undefined }))

  const prioritizedEntries = workingGear
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (usingTwoHandedWeapon && item.slot === "Off Hand") {
        return false
      }

      return true
    })
    .sort((a, b) => {
      const aPriority = getCrestUpgradePriority(a.item.slot, prioritizeTrinketsEarly)
      const bPriority = getCrestUpgradePriority(b.item.slot, prioritizeTrinketsEarly)

      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }

      return a.index - b.index
    })

  const overrideCandidates = prioritizedEntries.filter(({ item }) => slotOverrides[item.slot]?.enabled)
  const normalCandidates = prioritizedEntries.filter(({ item }) => !slotOverrides[item.slot]?.enabled)

  // First pass: apply explicit slot overrides and deduct those custom costs from the crest pool.
  for (const { item } of overrideCandidates) {
    const slotOverride = slotOverrides[item.slot]
    const hasValidOverrideCost = Number.isFinite(Number(slotOverride.crestCost)) && Number(slotOverride.crestCost) >= 0

    if (!hasValidOverrideCost) {
      item.crestNote = "Override enabled, but crest cost is invalid. Slot was skipped."
      continue
    }

    const overrideSlotCost = Math.trunc(Number(slotOverride.crestCost))

    if (crestsRemaining < overrideSlotCost) {
      item.crestNote = `Override set to ${overrideSlotCost} crests, but not enough crests remained to apply this slot.`
      continue
    }

    const currentTier = item.track === "Veteran" ? getVeteranTier(item.itemLevel) : null

    if (currentTier !== null && currentTier < 6) {
      const previousIlvlForOverride = item.itemLevel
      const nextIlvlForOverride = String(TRACK_LEVELS.Veteran[5])

      item.itemLevel = nextIlvlForOverride
      item.crestNote = `Spent ${overrideSlotCost} crests (override): Veteran ${currentTier}/6 -> 6/6 (${previousIlvlForOverride} -> ${nextIlvlForOverride}).`
    } else {
      item.crestNote = `Reserved ${overrideSlotCost} crests (override) for this slot. Equipped item was not changed.`
    }

    crestsRemaining -= overrideSlotCost
  }

  for (const { item } of normalCandidates) {
    if (item.track !== "Veteran") {
      continue
    }

    const currentTier = getVeteranTier(item.itemLevel)
    if (currentTier === null || currentTier >= 6) {
      continue
    }

    const stagesNeeded = 6 - currentTier
    const affordableStages = Math.floor(crestsRemaining / 20)
    const stagesApplied = Math.min(stagesNeeded, affordableStages)

    if (stagesApplied <= 0) {
      continue
    }

    const newTier = currentTier + stagesApplied
    const previousIlvl = item.itemLevel
    const nextIlvl = String(TRACK_LEVELS.Veteran[newTier - 1])
    const crestsSpentOnSlot = stagesApplied * 20

    item.itemLevel = nextIlvl
    item.crestNote = `Spent ${crestsSpentOnSlot} crests: Veteran ${currentTier}/6 -> ${newTier}/6 (${previousIlvl} -> ${nextIlvl}).`

    crestsRemaining -= crestsSpentOnSlot
  }

  return {
    gear: workingGear,
    crestsSpent: availableCrests - crestsRemaining,
    crestsRemaining,
  }
}

function App() {
  const persistedState = useMemo(() => loadPersistedState(), [])
  const [step, setStep] = useState(() => persistedState?.step ?? 1)
  const [confirmed] = useState(() => persistedState?.confirmed ?? false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [simcInput, setSimcInput] = useState("")
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => persistedState?.theme ?? getDefaultTheme())
  const [gear, setGear] = useState<GearEntry[]>(() => persistedState?.gear ?? getDefaultGear())
  const [usingTwoHandedWeapon, setUsingTwoHandedWeapon] = useState(() => persistedState?.usingTwoHandedWeapon ?? false)
  const [veteranCrests, setVeteranCrests] = useState(() => persistedState?.veteranCrests ?? "")
  const [prioritizeTrinketsEarly, setPrioritizeTrinketsEarly] = useState(() => persistedState?.prioritizeTrinketsEarly ?? false)
  const [slotOverrides, setSlotOverrides] = useState<Record<string, SlotOverride>>(
    () => persistedState?.slotOverrides ?? getDefaultSlotOverrides(),
  )
  const [crestCalculationResult, setCrestCalculationResult] = useState<CrestCalculationResult | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const [upgradePlan, setUpgradePlan] = useState<Record<string, PlannedUpgrade>>(
    () => persistedState?.upgradePlan ?? getDefaultUpgradePlan(),
  )

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step,
        confirmed,
        theme,
        gear,
        upgradePlan,
        usingTwoHandedWeapon,
        veteranCrests,
        prioritizeTrinketsEarly,
        slotOverrides,
      }),
    )
  }, [step, confirmed, theme, gear, upgradePlan, usingTwoHandedWeapon, veteranCrests, prioritizeTrinketsEarly, slotOverrides])

  const canContinueFromStepOne = gear.every((item) => {
    if (!isRequiredSlot(item.slot, usingTwoHandedWeapon)) {
      return true
    }

    const parsed = Number(item.itemLevel)

    return (
      item.itemLevel.trim().length > 0
      && item.track !== ""
      && Number.isFinite(parsed)
      && parsed > 0
    )
  })

  const resultGear = useMemo(
    () => gear.map((item) => applyUpgrade(item, upgradePlan[item.slot])),
    [gear, upgradePlan],
  )

  const ilvlSummary = useMemo(() => {
    const current = computeOverallItemLevel(gear, usingTwoHandedWeapon)
    const postPvp = computeOverallItemLevel(resultGear, usingTwoHandedWeapon)

    const finalSource = crestCalculationResult?.gear ?? null
    const final = finalSource
      ? computeOverallItemLevel(finalSource, usingTwoHandedWeapon)
      : null

    return { current, postPvp, final }
  }, [gear, resultGear, usingTwoHandedWeapon, crestCalculationResult])

  const crestDisplayGear = useMemo<CrestResultGearEntry[]>(() => {
    if (crestCalculationResult) {
      return crestCalculationResult.gear
    }

    return resultGear.map((item) => ({ ...item, crestNote: undefined }))
  }, [crestCalculationResult, resultGear])

  function handleCalculateCrests() {
    const calculation = calculateVeteranCrestUpgrades(
      resultGear,
      veteranCrests,
      prioritizeTrinketsEarly,
      usingTwoHandedWeapon,
      slotOverrides,
    )

    setCrestCalculationResult(calculation)
  }

  function updateSlotOverride(slot: string, patch: Partial<SlotOverride>) {
    setSlotOverrides((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        ...patch,
      },
    }))
  }

  function toggleSlotOverride(slot: string, nextEnabled: boolean) {
    setSlotOverrides((current) => {
      const currentOverride = current[slot]

      return {
        ...current,
        [slot]: {
          enabled: nextEnabled,
          crestCost: currentOverride.crestCost,
        },
      }
    })
  }

  const formattedCurrentItemLevel = formatItemLevel(ilvlSummary.current)
  const formattedFinalItemLevel = formatItemLevel(ilvlSummary.final)
  const formattedPostPvpItemLevel = formatItemLevel(ilvlSummary.postPvp)

  function updateGearValue(slot: string, field: keyof GearEntry, value: string) {
    setGear((current) =>
      current.map((entry) => (entry.slot === slot ? { ...entry, [field]: value } : entry)),
    )
  }

  function handleImportSimc() {
    const parsedItems = parseSimcEquippedItems(simcInput)
    const matchedSlots = Object.keys(parsedItems)

    if (matchedSlots.length === 0) {
      setImportStatus({
        type: "error",
        message: "No equipped item levels were found. Paste a full /simc export from the addon.",
      })
      return
    }

    let bonusInferredTrackCount = 0
    let inferredTrackCount = 0
    let ambiguousTrackCount = 0

    const hasMainHand = Boolean(parsedItems["Main Hand"])
    const hasOffHand = Boolean(parsedItems["Off Hand"])
    const hasAnyWeaponSlot = hasMainHand || hasOffHand
    const inferredTwoHandFromImport = hasMainHand !== hasOffHand

    if (hasAnyWeaponSlot) {
      setUsingTwoHandedWeapon(inferredTwoHandFromImport)
    }

    setGear((current) =>
      current.map((entry) => {
        if (inferredTwoHandFromImport && entry.slot === "Off Hand" && !parsedItems["Off Hand"]) {
          return {
            ...entry,
            itemLevel: "",
            track: "",
          }
        }

        const importedItem = parsedItems[entry.slot]
        if (!importedItem) {
          return entry
        }

        const inferredTrackFromBonus = inferTrackFromBonusIds(importedItem.bonusIds)
        const inferredTrackFromLevel = inferTrackFromItemLevel(importedItem.itemLevel)
        const inferredTrack = inferredTrackFromBonus ?? inferredTrackFromLevel

        if (inferredTrackFromBonus) {
          bonusInferredTrackCount += 1
        }

        if (inferredTrack) {
          inferredTrackCount += 1
        } else {
          ambiguousTrackCount += 1
        }

        return {
          ...entry,
          itemLevel: importedItem.itemLevel,
          track: inferredTrack ?? "",
        }
      }),
    )

    setImportStatus({
      type: "success",
      message: `Imported item levels for ${matchedSlots.length} equipped slot${matchedSlots.length === 1 ? "" : "s"}. Inferred track for ${inferredTrackCount} (${bonusInferredTrackCount} via bonus_id). Manual track review needed for ${ambiguousTrackCount}.`,
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,#f5f3ff_0%,#fafaff_32%,#ffffff_78%)] px-4 py-6 text-foreground transition-colors dark:bg-[radial-gradient(circle_at_10%_0%,#1f2937_0%,#111827_40%,#020617_90%)] sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Card className="border border-violet-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#fafaff_50%,#f5f3ff_100%)] text-slate-900 ring-1 ring-violet-100/80 shadow-2xl shadow-violet-300/25 dark:border-0 dark:bg-[linear-gradient(135deg,#0f172a_0%,#111827_50%,#1f2937_100%)] dark:text-slate-100 dark:ring-0 dark:shadow-violet-900/20">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-amber-500/60 bg-amber-100/70 text-amber-900 dark:border-amber-300/60 dark:bg-amber-50/10 dark:text-amber-200">
                  WoW Midnight Season 1
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-slate-300/80 bg-white/70 text-slate-900 hover:bg-white dark:border-slate-300/30 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800/60"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="mr-2 size-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 size-4" />
                      Dark Mode
                    </>
                  )}
                </Button>
              </div>
            </div>
            <CardTitle className="text-3xl tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Heroic Week Crest Planner
            </CardTitle>
            <CardDescription className="max-w-3xl text-base text-slate-700 dark:text-slate-200">
              Calculate final pre-raid item level potential using PvP and Veteran Crests. Does not include random upgrade potential from Bountiful Delves. 
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <Card className="h-fit border-0 bg-white/80 shadow-lg shadow-violet-200/70 dark:bg-slate-900/80 dark:shadow-slate-950/40">
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative space-y-2">
                {STEP_META.map((item) => {
                  const Icon = item.icon
                  const isCurrent = step === item.id
                  const isCompleted = step > item.id
                  const isLast = item.id === STEP_META.length

                  return (
                    <div
                      key={item.id}
                      className="relative pl-8"
                    >
                      {!isLast && (
                        <div
                          className={[
                            "absolute left-[0.66rem] top-5 w-px",
                            isCompleted ? "bg-primary/50" : "bg-border",
                          ].join(" ")}
                          style={{ height: "calc(100% + 0.5rem)" }}
                        />
                      )}
                      <div
                        className={[
                          "absolute top-1/2 left-0 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border",
                          isCompleted
                            ? "border-primary/60 bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border bg-background text-muted-foreground",
                        ].join(" ")}
                      >
                        <Icon className="size-3" />
                      </div>
                      <div
                        className={[
                          "rounded-lg px-2 py-2 transition-colors",
                          isCurrent
                            ? "bg-primary/10"
                            : "bg-background/70",
                        ].join(" ")}
                      >
                        <p className="truncate text-sm font-medium leading-tight">{item.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Separator className="my-4" />
              <div className="rounded-lg bg-background/70 px-2 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current ilvl</p>
                <p className="mt-1 text-xl leading-none font-semibold text-foreground">{formattedCurrentItemLevel}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Post-PvP ilvl</p>
                <p className="mt-1 text-lg leading-none font-semibold text-foreground">{formattedPostPvpItemLevel}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Final ilvl</p>
                <p className="mt-1 text-lg leading-none font-semibold text-foreground">{formattedFinalItemLevel}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/85 shadow-xl shadow-violet-200/70 dark:bg-slate-900/85 dark:shadow-slate-950/40">
            {step === 1 && (
              <>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle>Step 1: Enter Current Gear</CardTitle>
                      <CardDescription>
                        Add item level and item track for each slot.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={usingTwoHandedWeapon}
                        onClick={() => setUsingTwoHandedWeapon((current) => !current)}
                        className={[
                          "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                          usingTwoHandedWeapon
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        Using 2H Weapon
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImportStatus(null)
                          setIsImportOpen(true)
                        }}
                      >
                        Import SimC
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[14rem]">Slot</TableHead>
                          <TableHead className="w-24">Item Level</TableHead>
                          <TableHead className="w-32">Track</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gear.map((item) => {
                          const trackState = getTrackState(item.itemLevel, item.track)
                          const isOptionalOffHand = item.slot === "Off Hand" && usingTwoHandedWeapon

                          return (
                            <TableRow key={item.slot}>
                              <TableCell className="px-2 py-1.5 font-medium">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{item.slot}</span>
                                  <span
                                    className={[
                                      "inline-flex h-5 w-24 shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold whitespace-nowrap",
                                      isOptionalOffHand
                                        ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                        : trackState
                                        ? getTrackStateClasses(item.track, trackState.isValid)
                                        : "border-transparent bg-transparent text-transparent",
                                    ].join(" ")}
                                  >
                                    {isOptionalOffHand ? "Optional" : trackState ? trackState.label : "-"}
                                  </span>
                                </div>
                              </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <Input
                                className="h-7"
                                value={item.itemLevel}
                                onChange={(event) => updateGearValue(item.slot, "itemLevel", event.target.value)}
                                type="number"
                                min="1"
                                disabled={isOptionalOffHand}
                                placeholder="e.g. 240"
                              />
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <Select
                                value={item.track}
                                onValueChange={(value) => {
                                  if (value !== null && !isOptionalOffHand) {
                                    updateGearValue(item.slot, "track", value)
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-full min-w-28 px-2" disabled={isOptionalOffHand}>
                                  <SelectValue placeholder="Track" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TRACK_OPTIONS.map((track) => (
                                    <SelectItem key={track} value={track}>
                                      {track}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      All required fields must be filled. Off Hand is optional when 2H is enabled.
                    </p>
                    <Button disabled={!canContinueFromStepOne} onClick={() => setStep(2)}>
                      Continue to PvP Plan
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle>Step 2: Plan PvP Gear</CardTitle>
                  <CardDescription>
                    For each slot, choose None, 243 Veteran (Bloody Tokens), 246 Champion (Conquest), or 246 Crafted (Heraldry).
                  </CardDescription>
                  <CardDescription>
                    To figure out what you can pick with the budget available during Heroic Week, check out {" "}
                    <a
                      href="https://dbowers.io/midnight-s1-pvp"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-violet-700 underline decoration-violet-400/80 underline-offset-4 transition-colors hover:text-violet-800 dark:text-violet-300 dark:decoration-violet-400/70 dark:hover:text-violet-200"
                    >
                      this app, also made by me!
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[16rem]">Slot</TableHead>
                          <TableHead className="w-36 text-center">{PVP_UPGRADE_OPTION_META["Keep Current"].heading}</TableHead>
                          <TableHead className="w-36 text-center">{PVP_UPGRADE_OPTION_META["243 Veteran"].heading}</TableHead>
                          <TableHead className="w-36 text-center">{PVP_UPGRADE_OPTION_META["246 Champion"].heading}</TableHead>
                          <TableHead className="w-36 text-center">{PVP_UPGRADE_OPTION_META["246 Unupgradable"].heading}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gear.map((item) => {
                          const trackState = getTrackState(item.itemLevel, item.track)
                          const isOptionalOffHand = item.slot === "Off Hand" && usingTwoHandedWeapon

                          return (
                            <TableRow key={item.slot}>
                              <TableCell className="px-2 py-1.5 font-medium">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{item.slot}</span>
                                  <span
                                    className={[
                                      "inline-flex h-5 w-24 shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold whitespace-nowrap",
                                      isOptionalOffHand
                                        ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                        : trackState
                                          ? getTrackStateClasses(item.track, trackState.isValid)
                                          : "border-transparent bg-transparent text-transparent",
                                    ].join(" ")}
                                  >
                                    {isOptionalOffHand ? "Optional" : trackState ? trackState.label : "-"}
                                  </span>
                                </div>
                              </TableCell>
                              {PVP_UPGRADE_BUTTON_OPTIONS.map((option) => {
                                const isSelected = upgradePlan[item.slot] === option
                                const optionMeta = PVP_UPGRADE_OPTION_META[option]

                                return (
                                  <TableCell key={option} className="px-2 py-1.5 text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={[
                                        "h-8 w-full px-2 text-xs font-semibold",
                                        isSelected ? optionMeta.selectedClass : optionMeta.unselectedClass,
                                      ].join(" ")}
                                      onClick={() => {
                                        setUpgradePlan((current) => ({
                                          ...current,
                                          [item.slot]: option,
                                        }))
                                      }}
                                    >
                                      {isSelected ? optionMeta.selectedLabel : optionMeta.buttonLabel}
                                    </Button>
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back to Current Gear
                    </Button>
                    <Button onClick={() => setStep(3)}>Preview Final Gear</Button>
                  </div>
                </CardContent>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeader>
                  <CardTitle>Step 3: Confirm Overlaid Gear Set</CardTitle>
                  <CardDescription>
                    Review the resulting gear set after overlaying your PvP selections onto current gear. This confirms the new set before crest calculations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[8.5rem]">Slot</TableHead>
                          <TableHead className="w-28">New Ilvl</TableHead>
                          <TableHead className="w-40">Track State</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultGear.map((item) => (
                          <TableRow key={item.slot}>
                            <TableCell className="px-2 py-1.5 font-medium">{item.slot}</TableCell>
                            <TableCell className="px-2 py-1.5">{item.itemLevel}</TableCell>
                            <TableCell className="px-2 py-1.5">
                              <span
                                className={[
                                  "inline-flex h-5 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold whitespace-nowrap",
                                  getResultTrackStateClasses(item),
                                ].join(" ")}
                              >
                                {getResultTrackStateLabel(item)}
                              </span>
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              {item.note ? (
                                <span
                                  className={[
                                    "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                                    item.discountedChampionToVeteran
                                      ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                      : "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200",
                                  ].join(" ")}
                                >
                                  {item.note}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back to PvP Plan
                    </Button>
                    <Button onClick={() => setStep(4)}>
                      Continue to Veteran Crest Use
                    </Button>
                  </div>

                  {confirmed && (
                    <div className="rounded-xl border border-emerald-300/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700/70 dark:bg-emerald-900/20 dark:text-emerald-100">
                      Gear setup confirmed. Calculation logic can now be added on top of this final state.
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {step === 4 && (
              <>
                <CardHeader>
                  <CardTitle>Step 4: Veteran Crest Use</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <div className="w-full space-y-2">
                      <div className="space-y-1">
                        <label htmlFor="veteran-crests" className="text-sm font-medium">
                          Veteran crests available
                        </label>
                        <p className="text-xs text-muted-foreground">
                          You will be able to get 400 crests on Heroic week. If you have a Veteran item under a Champion equipped, you can manually override 20 crests if you want to discount the Champion item.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="w-full sm:w-40">
                          <Input
                            className="h-10"
                            id="veteran-crests"
                            type="number"
                            min="0"
                            step="1"
                            value={veteranCrests}
                            onChange={(event) => setVeteranCrests(event.target.value)}
                            placeholder="e.g. 400"
                          />
                        </div>
                        <button
                          type="button"
                          aria-pressed={prioritizeTrinketsEarly}
                          onClick={() => setPrioritizeTrinketsEarly((current) => !current)}
                          className={[
                            "h-10 rounded-md border px-3 text-sm font-medium transition-colors",
                            prioritizeTrinketsEarly
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border bg-background text-foreground hover:bg-muted",
                          ].join(" ")}
                        >
                          Prioritize trinkets early
                        </button>
                        <Button
                          type="button"
                          onClick={handleCalculateCrests}
                          className="h-10 px-3 text-sm font-medium"
                        >
                          Calculate
                        </Button>
                      </div>
                    </div>
                  </div>

                  {crestCalculationResult && (
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                      <span className="font-medium">Crests spent:</span> {crestCalculationResult.crestsSpent}
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="font-medium">Crests remaining:</span> {crestCalculationResult.crestsRemaining}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[8.5rem]">Slot</TableHead>
                          <TableHead className="w-28">New Ilvl</TableHead>
                          <TableHead className="w-40">Track State</TableHead>
                          <TableHead className="w-72">Crest Cost Override</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {crestDisplayGear.map((item) => {
                          const slotOverride = slotOverrides[item.slot]

                          return (
                            <TableRow key={item.slot}>
                              <TableCell className="px-2 py-1.5 font-medium">{item.slot}</TableCell>
                              <TableCell className="px-2 py-1.5">{item.itemLevel}</TableCell>
                              <TableCell className="px-2 py-1.5">
                                <span
                                  className={[
                                    "inline-flex h-5 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold whitespace-nowrap",
                                    getResultTrackStateClasses(item),
                                  ].join(" ")}
                                >
                                  {getResultTrackStateLabel(item)}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    aria-pressed={slotOverride.enabled}
                                    onClick={() => toggleSlotOverride(item.slot, !slotOverride.enabled)}
                                    className={[
                                      "h-8 rounded-md border px-2 text-xs font-medium transition-colors",
                                      slotOverride.enabled
                                        ? "border-primary/60 bg-primary/10 text-primary"
                                        : "border-border bg-background text-foreground hover:bg-muted",
                                    ].join(" ")}
                                  >
                                    {slotOverride.enabled ? "Override On" : "Override Off"}
                                  </button>
                                  {slotOverride.enabled && (
                                    <>
                                      <Input
                                        className="h-8 w-20"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={slotOverride.crestCost}
                                        onChange={(event) => updateSlotOverride(item.slot, { crestCost: event.target.value })}
                                        placeholder="cost"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        Total crests to take this slot to 6/6.
                                      </span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                {item.crestNote ? (
                                  <span className="inline-flex rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                    {item.crestNote}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => setStep(3)}>
                      Back to Gear Confirm
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>

      {isImportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Import simc string"
          onClick={() => setIsImportOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-background p-4 shadow-2xl ring-1 ring-border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Import SimC</h2>
              <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Close</Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Paste the full import string from /simc here to automatically fill in item levels for currently equipped items. 
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              It will try to infer all item tracks where possible, but it may fail in some cases. If there is any invalid fields in the table after importing, fix them manually.
            </p>
            <textarea
              className="mt-3 h-80 w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Paste /simc export here..."
              value={simcInput}
              onChange={(event) => setSimcInput(event.target.value)}
            />

            {importStatus && (
              <div
                className={[
                  "mt-3 rounded-md border px-3 py-2 text-sm",
                  importStatus.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100"
                    : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-100",
                ].join(" ")}
              >
                {importStatus.message}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportSimc}>Import Item Levels</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
