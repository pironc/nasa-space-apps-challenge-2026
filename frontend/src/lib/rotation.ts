// Rotation comparison: fixed rules over the crop catalogue, computed in the browser.
// Ported from docs/research/kazakhstan-agronomy/score_demo.py with its review defects fixed:
// no prices, no thirsty crop in the water card, soft zone gates, and cards that cannot
// contradict their own bars. Every weight, gate and what-if shift here is unreviewed judgement.
import type {
  FieldAnalysis,
  Indicator,
  Priorities,
  Strategy,
  StrategyInput,
  StressProfile,
} from "@/lib/analysis"

import { CROPS } from "../data/crop-catalogue.ts"
import type { Crop, CropId } from "../data/crop-catalogue.ts"

export const DEFAULT_PRIORITIES: Priorities = {
  water: 0.5,
  soil: 0.5,
  income: 0.5,
}

type Rot = readonly CropId[]
type Key = Indicator["key"]
type Scores = Record<Key, number>

const W = "spring_wheat"
const B = "barley"
const F = "fallow"

const BASELINES: Record<StrategyInput["declared"], Rot> = {
  fwwb: [F, W, W, B],
  wwww: [W, W, W, W],
  other: [W, W, W, W], // not declared: assumed continuous wheat, and the card says so
}

// Candidates. The pickers below filter them, so a template that breaks a card's promise can never win.
const WATER: Rot[] = [
  [W, "flax", W, B],
  [W, "millet", W, "flax"],
  [W, "millet", B, "flax"],
  [W, B, W, B], // smallest shift; beats either baseline on climate fit whenever there is any water or heat stress
  [W, "lentil", W, B],
  [W, "field_pea", W, B],
  [W, "chickpea", W, B],
  [F, W, "flax", B], // keeps the fallow year; only offered when the declared rotation has one
  [F, W, "millet", B],
]
const SOIL: Rot[] = [
  ["oats", W, W, B], // best-documented local replacement for bare fallow
  ["lentil", W, "flax", B],
  ["field_pea", W, "flax", B],
  ["chickpea", W, "flax", B],
  ["field_pea", W, "rapeseed", W],
  ["field_pea", W, "oats", W],
  ["lentil", W, "oats", W], // no zone gate and always above both baselines on the soil bar
  ["lentil", W, "millet", W],
  ["chickpea", W, "millet", W],
  ["sweet_clover", W, W, B],
]

const crop = (id: CropId): Crop => CROPS[id]
const clip = (x: number) => Math.max(0, Math.min(1, x))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const mid = (r: [number, number]) => (r[0] + r[1]) / 2
const isWheat = (id: CropId) => id === W || id === "durum"

/** The "drier" what-if: 1 means a quarter less May to August rain, with water and heat stress raised to match. */
const whatIf = (p: StressProfile, drier: number): StressProfile => {
  const d = clip(drier)
  return {
    ...p,
    water: clip(p.water + 0.4 * d),
    heat: clip(p.heat + 0.3 * d),
    rainMeanMm: p.rainMeanMm * (1 - 0.25 * d),
  }
}

// Zone gates. `margin` is how far inside its zone the crop sits: full fit a whole band inside,
// a sliding penalty across the gate, and 0 (never proposed) only a whole band outside.
const soft = (margin: number, band: number) => clip(0.5 + margin / (2 * band))
const GATES: Partial<Record<CropId, (p: StressProfile) => number>> = {
  rapeseed: (p) =>
    Math.min(soft(p.rainMeanMm - 200, 20), soft(0.3 - p.heat, 0.1)), // heat at flowering: forest-steppe only
  chickpea: (p) => soft(190 - p.rainMeanMm, 20), // disease and late maturity where it is wetter
  field_pea: (p) => soft(0.45 - p.heat, 0.1),
  sweet_clover: (p) => soft(0.4 - p.water, 0.15), // dries the profile for the next crop: not where water is already short
  millet: (p) => Math.min(soft(0.3 - p.frost, 0.1), soft(p.heat - 0.15, 0.1)), // frost kills it, and it needs a warm season
}
const zone = (id: CropId, p: StressProfile) => GATES[id]?.(p) ?? 1

/** Climate fit of one crop here, 0 to 1. */
const cropFit = (id: CropId, p: StressProfile) => {
  const c = crop(id)
  return (
    clip(
      1 -
        p.water * (1 - c.droughtTol / 5) -
        p.heat * (1 - c.heatTol / 5) -
        0.5 * p.frost * c.frostSens
    ) * zone(id, p)
  )
}

const wheatYield = mid(CROPS[W].yieldTHa)

function score(rot: Rot, p: StressProfile): Scores {
  const n = rot.length
  const prev = (i: number) => rot[(i + n - 1) % n] // a rotation is a cycle
  const sown = rot.filter((id) => id !== F)
  const cs = rot.map(crop)
  const afterThirsty =
    rot.filter((id, i) => id !== F && crop(prev(i)).waterUse >= 4).length / n
  return {
    climateFit: clip(
      mean(sown.map((id) => cropFit(id, p))) - 0.3 * afterThirsty * p.water
    ),
    soil: clip(
      (0.5 * mean(cs.map((c) => c.residue))) / 5 +
        0.3 * Math.min(1, mean(cs.map((c) => mid(c.nFix))) / 30) +
        0.2 * (1 - (4 * (n - sown.length)) / n)
    ),
    pestBreak: clip(
      1 -
        (0.6 * rot.filter(isWheat).length) / n -
        (0.8 * rot.filter((id, i) => isWheat(id) && isWheat(prev(i))).length) /
          n +
        0.15 * (new Set(sown.map((id) => crop(id).group)).size - 1)
    ),
    market: mean(cs.map((c) => c.market)) / 5,
    // Tonnes relative to wheat x climate fit x the predecessor effect on wheat. Unitless: not a yield or revenue forecast.
    // ponytail: counts tonnes, so it under-rates oilseeds and pulses; needs sourced prices before it can speak for income.
    productivity: clip(
      mean(
        rot.map((id, i) => {
          const y = crop(id).yieldTHa
          return y
            ? (mid(y) / wheatYield) *
                cropFit(id, p) *
                (isWheat(id) ? crop(prev(i)).nextWheat : 1)
            : 0
        })
      )
    ),
  }
}

/** Years of the rotation that would be farmed differently from today, whatever their order. */
const changedYears = (rot: Rot, base: Rot) => {
  const left = [...base]
  for (const id of rot) if (left.includes(id)) left.splice(left.indexOf(id), 1)
  return left.length
}

/** Each farmer priority scales its indicators from x0.5 to x1.5. There is no price anywhere. */
function total(
  kind: "water" | "soil",
  rot: Rot,
  current: Rot,
  s: Scores,
  p: StressProfile,
  pr: Priorities
) {
  const base: Scores =
    kind === "water"
      ? {
          climateFit: 0.5 + 0.2 * p.water,
          soil: 0.1,
          pestBreak: 0.1,
          market: 0.1,
          productivity: 0.2,
        }
      : {
          climateFit: 0.15,
          soil: 0.4 + 0.2 * p.bare,
          pestBreak: 0.2,
          market: 0.1,
          productivity: 0.15,
        }
  const tilt: Scores = {
    climateFit: pr.water,
    soil: pr.soil,
    pestBreak: pr.soil,
    market: pr.income,
    productivity: pr.income,
  }
  const keys = Object.keys(base) as Key[]
  const w = keys.map((k) => base[k] * (0.5 + clip(tilt[k])))
  const weighted =
    keys.reduce((sum, k, i) => sum + w[i] * s[k], 0) /
    w.reduce((a, b) => a + b, 0)
  // A crop near the edge of its zone pulls the whole rotation down, whatever the priorities say.
  // Each changed year costs 3% (new seed, machinery, buyers), so a bigger shift has to earn its place.
  return (
    weighted *
    mean(rot.map((id) => zone(id, p))) *
    (1 - 0.03 * changedYears(rot, current))
  )
}

const LABELS: Record<Key, string> = {
  climateFit: "Climate fit",
  soil: "Soil cover and nitrogen",
  pestBreak: "Pest-cycle break",
  market: "Market access",
  productivity: "Relative output",
}
const level = (v: number): Indicator["level"] =>
  v < 0.4 ? "low" : v < 0.7 ? "medium" : "high"
const indicators = (s: Scores): Indicator[] =>
  (Object.keys(LABELS) as Key[]).map((key) => ({
    key,
    label: LABELS[key],
    value: s[key],
    level: level(s[key]),
  }))

const list = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const label = (rot: Rot) =>
  new Set(rot).size === 1
    ? `${cap(crop(rot[0]).label)} every year`
    : cap(rot.map((id) => crop(id).label).join(", "))
/** Two rotations with the same crops in a different order are the same card to a farmer. */
const sameCrops = (a: Rot, b: Rot) =>
  [...a].sort().join() === [...b].sort().join()
const lines = (...xs: (string | false | null | undefined)[]) =>
  xs.filter((x): x is string => !!x).slice(0, 4)

// --- Card text ---------------------------------------------------------------

const NOTES: Partial<Record<CropId, { benefit: string; review?: string }>> = {
  barley: {
    benefit:
      "Barley ripens earlier than wheat and is rated as needing less water.",
  },
  flax: {
    benefit:
      "Flax is rated as more drought-tolerant than wheat and belongs to a different plant family.",
    review:
      "Flax can be damaged by herbicide left in the soil from earlier wheat years, and it leaves thin stubble against the wind.",
  },
  millet: {
    benefit:
      "Millet is rated the most drought- and heat-tolerant crop in the catalogue; in the 2012 drought it out-yielded wheat by 0.3 t/ha at Shortandy (Barayev centre).",
    review:
      "Millet is killed by frost: it is sown late into warm soil and must be off the field before the first autumn frost.",
  },
  lentil: {
    benefit:
      "Lentil is a pulse: bacteria on its roots take nitrogen from the air, so it adds some nitrogen instead of only removing it.",
    review:
      "Lentil needs the right inoculant (the bacteria that fix nitrogen), a header that cuts close to the ground, and four to five years before it returns to the same field.",
  },
  field_pea: {
    benefit:
      "Pea is a pulse: bacteria on its roots take nitrogen from the air, so it adds some nitrogen instead of only removing it.",
    review:
      "Pea needs the right inoculant (the bacteria that fix nitrogen), enough phosphorus and a header that cuts close to the ground.",
  },
  chickpea: {
    benefit:
      "Chickpea is a pulse rated as very drought-tolerant, and the Barayev centre recommends it for the driest districts.",
    review:
      "Chickpea needs its own inoculant strain (the bacteria that fix nitrogen) and ripens late, which exposes it to September frost.",
  },
  oats: {
    benefit:
      "Oats is the best-documented local replacement for bare fallow: in the Barayev centre trial, Shortandy, 2018 to 2020, oats, wheat, wheat, barley gave about 2.1 t/ha of grain a year against 1.7 with fallow.",
  },
  sweet_clover: {
    benefit:
      "Sweet clover is sown under a cereal and ploughed in the next summer: it covers the soil and is rated the strongest nitrogen source in the catalogue.",
    review:
      "Sweet clover uses more soil water than other green manures and has held back the following crop in dry years (Alberta Agriculture).",
  },
  rapeseed: {
    benefit:
      "Rapeseed suits wetter, cooler districts and belongs to a different plant family from wheat.",
    review:
      "Rapeseed is sensitive to heat at flowering and to herbicide left in the soil from earlier wheat years.",
  },
}

// Yield of the wheat that follows, against wheat after bare fallow. The pea range comes from older trials.
const TRIAL = "the Barayev centre trial, Shortandy, 2018 to 2020"
const NEXT_WHEAT: Partial<Record<CropId, string>> = {
  oats: `In ${TRIAL}, wheat after oats yielded about 6% less than wheat after fallow.`,
  lentil: `In ${TRIAL}, wheat after lentil yielded about 12% less than wheat after fallow.`,
  field_pea: `Older trials in the region put wheat after pea 18 to 25% below wheat after fallow; ${TRIAL}, measured about 12% less after lentil.`,
}

const RATINGS_GAP =
  "The bars compare options using crop ratings that no agronomist has reviewed yet: they are not a yield, price or income forecast."
const stress = (v: number) => (v < 0.2 ? "low" : v < 0.45 ? "moderate" : "high")

/** Evidence sentences. Every number comes from the analysis; a missing fact means no sentence. */
function facts(a: FieldAnalysis) {
  const cs = a.climate.seasons
  const years = cs.map((s) => s.year)
  const recent = cs.slice(-10)
  const dry = recent.length
    ? recent.reduce((m, s) => (s.rainMayAugPct < m.rainMayAugPct ? s : m))
    : null
  const usual =
    a.baseline && a.baseline.peakMedian > 0 ? a.baseline.peakMedian : null
  const hit = usual
    ? a.seasons
        .filter(
          (s) =>
            s.peak != null && s.verdicts.some((v) => v.type === "VEG_DEFICIT")
        )
        .sort((x, y) => x.peak! - y.peak!)[0]
    : undefined
  const bare = a.seasons.filter(
    (s) => s.use === "fallow" || s.verdicts.some((v) => v.type === "BARE_SOIL")
  )
  const year = hit?.year ?? dry?.year
  const modis = (a.modis?.years ?? []).filter(
    (y) => y.peak != null && y.use === "cropped"
  )
  const m = modis.find((y) => y.year === year)
  const rank = m ? modis.filter((y) => y.peak! < m.peak!).length : 5
  return {
    bareCount: bare.length,
    seasonCount: a.seasons.length,
    drought:
      cs.length > 0 &&
      `${a.climate.droughtYears.length || "None"} of the ${cs.length} seasons from ${Math.min(...years)} to ${Math.max(...years)} were flagged as short of water in the regional weather record (NASA POWER).`,
    worst:
      dry &&
      `In ${dry.year}, the driest of the last ${recent.length} seasons, May to August rain was ${Math.round(dry.rainMayAugPct)}% of normal, with ${Math.round(dry.hotDays30)} days at 30 °C or hotter (normal: ${Math.round(a.climate.normals.hotDays30)}).`,
    greenness:
      hit && usual
        ? `In ${hit.year} this field's peak greenness reached ${Math.round((100 * hit.peak!) / usual)}% of its usual peak (Sentinel-2)` +
          (hit.verdicts.some((v) => v.type === "LOW_CANOPY_MOISTURE")
            ? ", and the canopy was drier than usual, which is consistent with a water shortage."
            : ".")
        : null,
    bare:
      a.seasons.length > 0 &&
      (bare.length
        ? `The satellite curve reads as bare or fallow all summer in ${bare.length} of the ${a.seasons.length} seasons observed (${bare.map((s) => s.year).join(", ")}).`
        : `No bare or fallow summer shows in the ${a.seasons.length} seasons observed.`),
    modis:
      m &&
      rank < 5 &&
      `In the NASA MODIS record of ${modis.length} cropped summers since ${Math.min(...modis.map((y) => y.year))}, ${m.year} had the ${["lowest", "second-lowest", "third-lowest", "fourth-lowest", "fifth-lowest"][rank]} peak greenness.`,
    soil:
      a.soil &&
      `Modelled soil here is about ${Math.round(a.soil.clayPct)}% clay and ${Math.round(a.soil.sandPct)}% sand (ISRIC SoilGrids: a model, not a field test).`,
  }
}

export function compareStrategies(input: StrategyInput): Strategy[] {
  const { analysis, declared, priorities: pr } = input
  const p = whatIf(analysis.profile, input.drier)
  const f = facts(analysis)
  const base = BASELINES[declared]
  const baseScore = score(base, p)
  const hasFallow = base.includes(F)

  const rank = (
    kind: "water" | "soil",
    templates: Rot[],
    ok: (s: Scores) => boolean
  ) => {
    const scored = templates
      .filter((rot) => rot.every((id) => zone(id, p) > 0))
      .map((rot) => ({ rot, s: score(rot, p) }))
    const kept = scored.filter((c) => ok(c.s))
    // Only a record with no water or heat stress at all leaves `kept` empty; the card then says so.
    return {
      honest: kept.length > 0,
      ranked: (kept.length ? kept : scored)
        .map((c) => ({ ...c, total: total(kind, c.rot, base, c.s, p, pr) }))
        .sort((x, y) => y.total - x.total),
    }
  }
  const water = rank(
    "water",
    WATER.filter(
      (rot) =>
        rot.every((id) => crop(id).waterUse < 4) &&
        (hasFallow || !rot.includes(F))
    ),
    (s) => s.climateFit > baseScore.climateFit
  )
  const soil = rank(
    "soil",
    SOIL.filter(
      (rot) => !rot.includes(F) && !sameCrops(rot, water.ranked[0].rot)
    ),
    (s) => s.soil > baseScore.soil
  )

  const high = (["water", "soil", "income"] as const).filter(
    (k) => pr[k] >= 0.75
  )
  const priorityLine =
    high.length > 0 &&
    `You gave ${list(high)} a high priority, which shifted the weights behind this choice.`
  const stressLine =
    `Water stress in this location's weather record is ${stress(analysis.profile.water)} and heat stress is ${stress(analysis.profile.heat)}.` +
    (input.drier > 0
      ? ` With the drier what-if applied they count as ${stress(p.water)} and ${stress(p.heat)}: a what-if, not a forecast.`
      : "")

  const shift = (kind: "water" | "soil", { ranked, honest }: typeof water) => {
    const { rot, s } = ranked[0]
    const years = (r: Rot, id: CropId) => r.filter((x) => x === id).length
    const fresh = [...new Set(rot)].filter(
      (id) => id !== F && years(rot, id) > years(base, id)
    ) // crops given more years than now
    const replacesFallow = hasFallow && !rot.includes(F)
    const feedsWheat = rot.find(
      (id, i) => NEXT_WHEAT[id] && isWheat(rot[(i + 1) % rot.length])
    )
    return {
      rotation: [...rot],
      rotationLabel: label(rot),
      indicators: indicators(s),
      closeCall:
        ranked[1] && ranked[0].total - ranked[1].total < 0.03
          ? `${label(ranked[1].rot)} scored almost the same.`
          : null,
      benefits: lines(
        ...fresh.slice(0, 2).map((id) => NOTES[id]?.benefit),
        kind === "water"
          ? "Whatever the rotation, tall stubble left over winter traps snow for the next crop; for wheat, the Barayev centre's long-term results favour sowing around 20 to 25 May."
          : s.pestBreak > baseScore.pestBreak &&
              "Fewer wheat crops in a row helps break the root-disease, weed and insect cycles that build up under wheat.",
        ...fresh
          .filter((id) => crop(id).market >= 4)
          .map((id) => crop(id).marketNote)
      ),
      localReview: lines(
        replacesFallow &&
          "This option sows a crop in the bare-fallow year. A sown crop uses water that bare fallow would have stored for the next wheat.",
        feedsWheat && NEXT_WHEAT[feedsWheat],
        ...fresh.map((id) => NOTES[id]?.review),
        ...fresh
          .filter((id) => crop(id).market < 4)
          .map((id) => crop(id).marketNote),
        kind === "water"
          ? "Seed supply and a buyer within reach for each new crop."
          : "Soil gains take several seasons: check the lease length and regional subsidy rules before committing."
      ),
      change: honest
        ? `This option changes ${changedYears(rot, base)} of the ${rot.length} years, with more ${list(fresh.map((id) => crop(id).label))}`
        : `No option here beats the current rotation on ${kind === "water" ? "climate fit" : "soil cover and nitrogen"}; this is the closest`,
    }
  }
  const w = shift("water", water)
  const s = shift("soil", soil)

  return [
    {
      kind: "baseline",
      title: "Keep the current rotation",
      rotation: [...base],
      rotationLabel: label(base),
      indicators: indicators(baseScore),
      closeCall: null,
      why: lines(
        declared === "other"
          ? 'You chose "other or not sure", so this card assumes wheat every year. The comparison is only as good as that assumption.'
          : `You declared ${label(base).toLowerCase()}. The other two options are measured against it.`,
        stressLine
      ),
      evidence: lines(
        f.greenness,
        f.drought,
        f.bare &&
          f.bare +
            (hasFallow && f.bareCount === 0 && f.seasonCount >= 4
              ? " The declared rotation has a fallow year every fourth summer, so the declaration is worth checking."
              : !hasFallow && f.bareCount > 0
                ? " That does not match a crop every year: it was either fallow or a failed crop."
                : "")
      ),
      benefits: lines(
        "No new machinery, seed or buyers are needed.",
        hasFallow
          ? "The fallow year stores some water for the first wheat, though local research (Suleimenov and Akshalov) suggests only 5 to 15% more than standing stubble."
          : CROPS[W].marketNote
      ),
      gaps: lines(
        "Which crop and variety was sown each year is not visible from orbit: the rotation is what you declared.",
        "A summer with little green can be a fallow year or a failed crop; the satellite curve alone cannot tell them apart.",
        "Weed seeds, disease carried over in the soil and insect pressure.",
        RATINGS_GAP
      ),
      localReview: lines(
        hasFallow
          ? "Bare fallow leaves the soil open to wind and water for a whole summer: look for blown soil and washed channels."
          : "Root diseases, weeds and insects build up when wheat follows wheat: ask how the last few crops looked at harvest.",
        hasFallow
          ? "The second wheat after fallow usually yields 15 to 20% less than the first (USDA, 2009)."
          : "Nitrogen and phosphorus left after years of wheat: only a soil test can say."
      ),
    },
    {
      kind: "water",
      title: "Climate and water-resilient shift",
      rotation: w.rotation,
      rotationLabel: w.rotationLabel,
      indicators: w.indicators,
      closeCall: w.closeCall,
      why: lines(
        stressLine,
        `${w.change}${!water.honest ? "" : w.indicators[0].value - baseScore.climateFit < 0.02 ? "; on this weather record its edge over the current rotation on climate fit is small" : "; taken together, its crops are rated as coping better with drought and heat than the current rotation's"}.`,
        "Sunflower and rapeseed are left out: both draw heavily on soil water and can leave the ground dry for the next crop.",
        priorityLine
      ),
      evidence: lines(f.worst, f.greenness, f.modis, f.drought),
      benefits: w.benefits,
      gaps: lines(
        "Water stored deep in the soil after winter is not measured.",
        "Snow depth and stubble height on this field.",
        "Rain and heat come from a regional weather grid, not from this field.",
        RATINGS_GAP
      ),
      localReview: w.localReview,
    },
    {
      kind: "soil",
      title: "Soil-restoring shift",
      rotation: s.rotation,
      rotationLabel: s.rotationLabel,
      indicators: s.indicators,
      closeCall: s.closeCall,
      why: lines(
        hasFallow
          ? "Bare fallow leaves the soil uncovered for a whole summer, one year in four."
          : "Wheat every year returns no nitrogen to the soil and never interrupts wheat's root diseases, weeds and insects.",
        `${s.change}${soil.honest ? ", and it comes out higher than the current rotation on soil cover and nitrogen" : ""}.`,
        priorityLine
      ),
      evidence: lines(f.bare, f.soil),
      benefits: s.benefits,
      gaps: lines(
        "Salt-affected patches, soil acidity, phosphorus and nitrate need a soil test.",
        "Herbicide history of the field.",
        analysis.soil
          ? "The soil figures shown come from a global soil model, not from samples taken on this field."
          : "Soil organic matter is not measured from orbit.",
        RATINGS_GAP
      ),
      localReview: s.localReview,
    },
  ]
}
