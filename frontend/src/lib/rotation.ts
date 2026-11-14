// Rotation comparison: fixed rules over the crop catalogue, computed in the browser.
// Ported from docs/research/kazakhstan-agronomy/score_demo.py with its review defects fixed:
// no prices, no thirsty crop in the water card, soft zone gates, and cards that cannot
// contradict their own bars. Every weight, gate and what-if shift here is unreviewed judgement.
// The cards are options to discuss with an agronomist: nothing here is advice or a forecast.
import type {
  FieldAnalysis,
  Indicator,
  Priorities,
  Season,
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
// The one rotation measured locally (Barayev centre, Shortandy, 2018 to 2020), against the fallow rotation.
const TRIAL_ROT: Rot = ["oats", W, W, B]
const SOIL: Rot[] = [
  TRIAL_ROT,
  ["field_pea", W, "rapeseed", W],
  ["field_pea", W, "oats", W],
  ["lentil", W, "oats", W], // no zone gate, and nitrogen lifts it 0.05 above both baselines on the soil bar
  ["lentil", W, "millet", W],
  ["chickpea", W, "millet", W],
  ["sweet_clover", W, W, B],
]

const crop = (id: CropId): Crop => CROPS[id]
const clip = (x: number) => Math.max(0, Math.min(1, x))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const mid = (r: [number, number]) => (r[0] + r[1]) / 2
const isWheat = (id: CropId) => id === W || id === "durum"
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** Crop name for a year chip, e.g. "Wheat". Unknown ids come back readable rather than blank. */
export const cropLabel = (id: string) =>
  cap(CROPS[id as CropId]?.label ?? id.replaceAll("_", " "))
/** Thin stubble: little left to hold the soil against the wind. */
const thin = (rot: Rot) =>
  rot.filter((id) => id !== F && crop(id).residue <= 2).length
const cover = (rot: Rot) => mean(rot.map((id) => crop(id).residue))
// Broadleaf hosts of white mould (Sclerotinia). Standard agronomy, unsourced: judgement.
const MOULD: CropId[] = [
  "field_pea",
  "lentil",
  "chickpea",
  "rapeseed",
  "sunflower",
]
/** Tonnes against wheat on the same footing: local trial yields where the catalogue has one, else the national range. */
const relYield = (c: Crop) =>
  c.yieldLocalTHa
    ? c.yieldLocalTHa / CROPS[W].yieldLocalTHa
    : c.yieldTHa
      ? mid(c.yieldTHa) / mid(CROPS[W].yieldTHa)
      : 0

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
  // Review gate: full fit from 190 mm of May to August rain, borderline from 170, never below. Heat at flowering.
  rapeseed: (p) =>
    Math.min(soft(p.rainMeanMm - 180, 10), soft(0.3 - p.heat, 0.1)),
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
    // Never above 0.8: a break crop does not clean a field. Two white-mould hosts in four years: never high.
    // Cereals only (wheat with barley, oats or millet): never above 0.5, they share root rots, grass weeds and herbicides.
    pestBreak: Math.min(
      sown.every((id) => crop(id).group.startsWith("cereal")) ||
        sown.filter((id) => MOULD.includes(id)).length > 1
        ? 0.5
        : 0.8,
      clip(
        1 -
          (0.6 * rot.filter(isWheat).length) / n -
          (0.8 *
            rot.filter((id, i) => isWheat(id) && isWheat(prev(i))).length) /
            n +
          0.15 * (new Set(sown.map((id) => crop(id).group)).size - 1)
      )
    ),
    market: mean(cs.map((c) => c.market)) / 5,
    // Tonnes relative to wheat x climate fit x the predecessor effect, whatever the crop that follows.
    // Unitless: not a yield or revenue forecast.
    // ponytail: counts tonnes, so it under-rates oilseeds and pulses; needs sourced, dated prices before it can speak for value.
    productivity: clip(
      mean(
        rot.map(
          (id, i) =>
            relYield(crop(id)) * cropFit(id, p) * crop(prev(i)).nextWheat
        )
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
  kind: "water" | "soil" | "any", // "any": the mean of both cards' weights, for the fit bar on all three cards
  rot: Rot,
  current: Rot,
  s: Scores,
  p: StressProfile,
  pr: Priorities
) {
  const forWater: Scores = {
    climateFit: 0.5 + 0.2 * p.water,
    soil: 0.1,
    pestBreak: 0.1,
    market: 0.1,
    productivity: 0.2,
  }
  const forSoil: Scores = {
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
  const keys = Object.keys(tilt) as Key[]
  const base = (k: Key) =>
    kind === "water"
      ? forWater[k]
      : kind === "soil"
        ? forSoil[k]
        : (forWater[k] + forSoil[k]) / 2
  const w = keys.map((k) => base(k) * (0.5 + clip(tilt[k])))
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
  pestBreak: "Break from wheat diseases and weeds",
  market: "Market access",
  productivity: "Relative output (no unit)",
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

/** The five bars for any rotation of catalogue crop ids, for the self-check. */
export const rateRotation = (rot: string[], p: StressProfile) =>
  indicators(score(rot as CropId[], p))

const list = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`
const label = (rot: Rot) =>
  new Set(rot).size === 1
    ? `${cap(crop(rot[0]).label)} every year`
    : cap(rot.map((id) => crop(id).label).join(", "))
/** Two rotations with the same crops in a different order are the same card to a farmer. */
const sameCrops = (a: Rot, b: Rot) =>
  [...a].sort().join() === [...b].sort().join()
const lines = (...xs: (string | false | null | undefined)[]) =>
  xs.filter((x): x is string => !!x).slice(0, 4)
const names = (ids: CropId[]) => list(ids.map((id) => crop(id).label))
// Wheat, barley and oats were grown in the local rotation trial; any other crop needs its own local trial yield.
const grade = (rot: Rot) =>
  sameCrops(rot, TRIAL_ROT)
    ? "Local rotation trial"
    : rot.every(
          (id) => id === F || TRIAL_ROT.includes(id) || crop(id).yieldLocalTHa
        )
      ? "Each crop trialled locally; this sequence is not"
      : "Judgement"

// --- Card text ---------------------------------------------------------------

// `gap`: the one thing about this crop on this field that no satellite shows.
const NOTES: Partial<
  Record<CropId, { benefit: string; review?: string; gap: string }>
> = {
  barley: {
    benefit:
      "Barley ripens earlier than wheat and is rated as needing less water.",
    review:
      "Barley shares root rots, grass weeds and herbicides with wheat: it spreads the weather risk but is only a partial break from wheat diseases.",
    gap: "When barley was sown and when it ripened on this field, which decide whether it escapes a July dry spell.",
  },
  flax: {
    benefit:
      "Flax is rated as more drought-tolerant than wheat and belongs to a different plant family.",
    review:
      "Flax leaves thin stubble, so the soil is less protected against the wind after it.",
    gap: "How much of the thin flax stubble stays standing through winter on this field.",
  },
  millet: {
    benefit:
      "Millet is rated the most drought- and heat-tolerant crop in the catalogue; in a dry year (2012) it out-yielded wheat by 0.3 t/ha at Shortandy (Barayev centre).",
    review:
      "Millet is killed by frost: it is sown late into warm soil and must be off the field before the first autumn frost.",
    gap: "Soil temperature at sowing and the first autumn frost on this field, which decide a millet crop.",
  },
  lentil: {
    benefit:
      "Lentil is a pulse: with the right inoculant (seed-applied bacteria) and enough moisture, those bacteria live on its roots and take nitrogen from the air, so it adds some instead of only removing it.",
    review:
      "Lentil needs a header that cuts close to the ground, and four to five years before it returns to the same field (Barayev centre).",
    gap: "Whether lentil roots formed nodules, the sign that nitrogen is being taken from the air.",
  },
  field_pea: {
    benefit:
      "Pea is a pulse: with the right inoculant (seed-applied bacteria) and enough moisture, those bacteria live on its roots and take nitrogen from the air, so it adds some instead of only removing it.",
    review:
      "Pea needs enough phosphorus and a header that cuts close to the ground.",
    gap: "Whether pea roots formed nodules, the sign that nitrogen is being taken from the air.",
  },
  chickpea: {
    benefit:
      "Chickpea is a pulse rated as very drought-tolerant, and the Barayev centre names it for the driest districts.",
    review:
      "Chickpea needs its own inoculant strain (the bacteria that fix nitrogen) and ripens late, which exposes it to September frost.",
    gap: "September frost on this field, which decides whether chickpea ripens.",
  },
  oats: {
    benefit:
      "Oats leaves as much stubble as wheat; sown in place of bare fallow it averaged about 2.4 t/ha over 20 years in Barayev centre trials.",
    review:
      "Wild oat cannot be controlled inside an oat crop: check how much wild oat the field carries first.",
    gap: "How much wild oat this field carries.",
  },
  sweet_clover: {
    benefit:
      "Sweet clover is sown under a cereal and worked into the soil, or killed and left as mulch, the next summer: it is rated the strongest nitrogen source in the catalogue, and wheat after it averaged about 2 t/ha over 13 years in Barayev centre trials.",
    review:
      "Sweet clover uses more soil water than other green manures and has held back the following crop in dry years (Alberta Agriculture).",
    gap: "Whether the sweet clover stand established under the cover crop.",
  },
  rapeseed: {
    benefit:
      "Rapeseed suits wetter, cooler districts and belongs to a different plant family from wheat.",
    review:
      "Rapeseed is sensitive to heat at flowering, and its fit here rests on rain figures from a regional grid: a local check is needed.",
    gap: "Heat on this field in the weeks rapeseed flowers.",
  },
}

// Yield of the wheat that follows, against wheat after bare fallow. The pea range comes from older trials.
const TRIAL = "the Barayev centre trial, Shortandy, 2018 to 2020"
const NEXT_WHEAT: Partial<Record<CropId, string>> = {
  oats: `In ${TRIAL}, wheat after oats yielded about 6% less than wheat after fallow.`,
  lentil: `In ${TRIAL}, wheat after lentil yielded about 12% less than wheat after fallow.`,
  field_pea: `Older trials in the region put wheat after pea 18 to 25% below wheat after fallow; ${TRIAL}, measured about 12% less after lentil.`,
}

const TRIAL_LINE = `oats, wheat, wheat, barley is the one rotation measured locally: in ${TRIAL}, it gave about 27% more grain per rotation hectare than the fallow rotation.`
const COVERED =
  "Your rotation already keeps residue on the soil. The gains available are nitrogen and a break from wheat diseases, not soil cover."
/** What the bars are, and which crops fell back on the national yield range for want of a local trial figure. */
const ratingsGap = (rot: Rot) => {
  const national = [...new Set(rot)].filter(
    (id) => !crop(id).yieldLocalTHa && crop(id).yieldTHa
  )
  return (
    "The bars are relative ratings with no unit, built on a draft crop catalogue (dated 2026-11-14) that no local agronomist has reviewed. They are not a yield or price forecast, and the disease and weed bar does not replace scouting." +
    (national.length
      ? ` Relative output for ${names(national)} rests on the national yield range, not on a local trial.`
      : "")
  )
}
const stress = (v: number) =>
  v < 0.2 ? "small" : v < 0.45 ? "moderate" : "large"

// Land use per season: the owner's declaration wins over the reading of the curve, and a season that is
// neither declared nor clear from the curve (failed crop or fallow?) is left out of every count.
const unclear = (s: Season) =>
  !s.declared && (s.use === "ambiguous" || s.use === "unknown")
const fallowLike = (s: Season) =>
  s.declared
    ? s.declared === "fallow"
    : s.use === "fallow" || s.verdicts.some((v) => v.type === "BARE_SOIL")

/** Evidence sentences. Every number comes from the analysis; a missing fact means no sentence. */
function facts(a: FieldAnalysis) {
  const cs = a.climate.seasons
  const years = cs.map((s) => s.year)
  const droughts = a.climate.droughtYears
  const recent = cs.slice(-10)
  const dry = recent.length
    ? recent.reduce((m, s) => (s.rainMayAugPct < m.rainMayAugPct ? s : m))
    : null
  const clear = a.seasons.filter((s) => !unclear(s))
  const left = a.seasons.filter(unclear)
  const bare = clear.filter(fallowLike)
  const fallowYears = (given: boolean, one: string, many: string) => {
    const ys = bare.filter((s) => !!s.declared === given).map((s) => s.year)
    return (
      ys.length > 0 && `${list(ys.map(String))} ${ys.length > 1 ? many : one}`
    )
  }
  // The lowest cropped season with a greenness deficit, in the analysis's own words.
  const hit = clear
    .filter((s) => !fallowLike(s) && s.peak != null)
    .sort((x, y) => x.peak! - y.peak!)
    .find((s) => s.verdicts.some((v) => v.type === "VEG_DEFICIT"))
  const year = hit?.year ?? dry?.year
  const modis = (a.modis?.years ?? []).filter(
    (y) => y.peak != null && y.use === "cropped"
  )
  const m = modis.find((y) => y.year === year)
  const rank = m ? modis.filter((y) => y.peak! < m.peak!).length : 5
  return {
    bareCount: bare.length,
    // Says "marked", not "you gave": on the demo fields the land use was assumed by the team.
    approximation:
      bare.length > 0 &&
      ` ${[
        fallowYears(true, "is marked as fallow", "are marked as fallow"),
        fallowYears(
          false,
          "reads as bare or fallow on the satellite curve",
          "read as bare or fallow on the satellite curve"
        ),
      ]
        .filter(Boolean)
        .join(
          " and "
        )}, so wheat every year is an approximation of this field.`,
    clearCount: clear.length,
    drought:
      cs.length > 0 &&
      (droughts.length
        ? `NASA POWER: the driest fifth of seasons since ${Math.min(...years)} by rain set against heat (regional grid): ${droughts.join(", ")}. A May to August total can hide a dry June and July.`
        : `NASA POWER: no season since ${Math.min(...years)} falls in the driest fifth by rain set against heat (regional grid).`),
    worst:
      dry &&
      `NASA POWER: in ${dry.year}, the driest of the last ${recent.length} seasons, May to August rain was ${Math.round(dry.rainMayAugPct)}% of normal, with ${Math.round(dry.hotDays30)} days at 30 °C or hotter (normal: ${Math.round(a.climate.normals.hotDays30)}). By this location's own record that season was ${dry.drought === "none" ? "not a drought" : dry.drought === "severe" ? "a severe drought" : "a drought"}: rank ${dry.htcRank} of ${dry.htcRankOf} for moisture, 1 being the driest.`,
    greenness:
      hit &&
      `Sentinel-2 (ESA): season ${hit.year}. ${hit.verdicts.find((v) => v.type === "VEG_DEFICIT")!.detail}${hit.explanation ? ` ${hit.explanation}` : ""}`,
    bare:
      a.seasons.length > 0 &&
      (bare.length
        ? `Sentinel-2 (ESA): bare or fallow summers, taking the land use given for the field first and the satellite curve otherwise: ${bare.length} of the ${clear.length} seasons with a clear land use (${bare.map((s) => s.year).join(", ")}).`
        : `Sentinel-2 (ESA): no bare or fallow summer shows in the ${clear.length} seasons with a clear land use.`),
    unclear: left.length
      ? ` Seasons left out because the curve could be a failed crop or a fallow and none was declared: ${left.length} (${left.map((s) => s.year).join(", ")}).`
      : "",
    modis:
      m &&
      rank < 5 &&
      `NASA MODIS: in ${m.year} this field ${rank ? `was among the ${rank + 1} lowest` : "had the lowest peak greenness"} of ${modis.length} cropped-looking summers since ${Math.min(...modis.map((y) => y.year))} (250 m pixels that include neighbouring land).`,
    soil:
      a.soil &&
      `ISRIC SoilGrids: modelled soil here is about ${Math.round(a.soil.clayPct)}% clay and ${Math.round(a.soil.sandPct)}% sand (a model, not a field test).`,
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
    ok: (s: Scores) => boolean,
    pr: Priorities
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
  const pick = (pr: Priorities) => {
    const water = rank(
      "water",
      WATER.filter(
        (rot) =>
          rot.every((id) => crop(id).waterUse < 4) &&
          (hasFallow || !rot.includes(F))
      ),
      (s) => s.climateFit > baseScore.climateFit,
      pr
    )
    const soil = rank(
      "soil",
      SOIL.filter(
        (rot) =>
          !rot.includes(F) &&
          thin(rot) <= 1 &&
          !sameCrops(rot, water.ranked[0].rot)
      ),
      (s) => s.soil >= baseScore.soil + 0.05,
      pr
    )
    return { water, soil }
  }
  const { water, soil } = pick(pr)
  // Continuous wheat already leaves as much residue as any option here: the card must not promise more cover.
  const noCoverGain = !soil.honest || cover(soil.ranked[0].rot) <= cover(base)

  // Only claims the priorities changed a card when its rotation differs from the one at the middle settings.
  const usual = (["water", "soil", "income"] as const).every(
    (k) => pr[k] === DEFAULT_PRIORITIES[k]
  )
    ? null
    : pick(DEFAULT_PRIORITIES)
  const priorityLine = (kind: "water" | "soil") => {
    const was = usual?.[kind].ranked[0].rot
    const now = (kind === "water" ? water : soil).ranked[0].rot
    return (
      was &&
      (was.join() === now.join()
        ? "The same option holds at these priorities as with all three at medium."
        : `Your priorities changed this option: with all three at medium it would be ${label(was).toLowerCase()}.`)
    )
  }
  /** The bar that moves with every slider: the ranking's own total, on weights midway between the two shift cards. */
  const fit = (rot: Rot, s: Scores) => clip(total("any", rot, base, s, p, pr))
  // profile.water and profile.heat are averages against the cell's own normal, so they say nothing about how dry that normal is.
  const htc = analysis.climate.normals.htc
  const stressLine =
    `This location's weather record gives two ratings. Rain shortfall, meaning how often and how far May to August rain falls short of its own normal: ${stress(analysis.profile.water)}. Heat, meaning how often a season has many days at 30 °C or hotter: ${stress(analysis.profile.heat)}.` +
    (htc < 1
      ? ` The normal itself is dry: hydrothermal coefficient ${htc.toFixed(2)}, where about 1 is enough moisture.`
      : ` The normal hydrothermal coefficient is ${htc.toFixed(2)}, where about 1 is enough moisture.`) +
    (input.drier > 0
      ? ` With the drier what-if applied the two ratings become ${stress(p.water)} and ${stress(p.heat)}: a what-if, not a forecast.`
      : "")

  const shift = (kind: "water" | "soil", { ranked, honest }: typeof water) => {
    const { rot, s } = ranked[0]
    const n = rot.length
    const years = (r: Rot, id: CropId) => r.filter((x) => x === id).length
    const sprayed = [
      ...new Set(
        rot.filter(
          (id, i) =>
            ["pulse", "oilseed"].includes(crop(id).group) &&
            crop(rot[(i + n - 1) % n]).group.startsWith("cereal")
        )
      ),
    ]
    const mould = [...new Set(rot.filter((id) => MOULD.includes(id)))]
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
      evidenceGrade: grade(rot),
      gap: ratingsGap(rot),
      cropGap: NOTES[fresh[0]]?.gap,
      priorityFit: fit(rot, s),
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
              "Fewer wheat crops in a row gives a break from the root diseases and weeds that build up under wheat. It does not replace scouting: at the Barayev centre in 2020, septoria and related spot diseases covered 36 to 40% of the wheat after every crop tried, and after fallow.",
        ...fresh
          .filter((id) => crop(id).market >= 4)
          .map((id) => crop(id).marketNote)
      ),
      localReview: lines(
        sprayed.length > 0 &&
          `Before sowing ${names(sprayed)}: check which herbicides were used on this field in the last two seasons. Residues of sulfonylureas (a common group of cereal herbicides) and some others last longer in dry, alkaline soil and can injure ${names(sprayed)}. This app cannot see herbicide history.`,
        ...[...new Set(rot)]
          .filter((id) => (crop(id).minReturnYears ?? 0) > n / years(rot, id))
          .map(
            (id) =>
              `${cap(crop(id).label)} every ${n / years(rot, id)} years is shorter than the usual ${crop(id).minReturnYears}-year gap; alternate with another break crop.`
          ),
        mould.length > 1 &&
          `${cap(names(mould))} can each carry white mould (Sclerotinia) and come within two years of each other here, so the disease and weed bar is held down.`,
        replacesFallow &&
          "This option sows a crop in the bare-fallow year. A sown crop uses water that bare fallow would have stored for the next wheat.",
        ...fresh.map((id) => NOTES[id]?.review),
        feedsWheat && NEXT_WHEAT[feedsWheat],
        ...fresh
          .filter((id) => crop(id).market < 4)
          .map((id) => crop(id).marketNote),
        kind === "water"
          ? "Seed supply and a buyer within reach for each new crop."
          : "Soil gains take several seasons: check the lease length and regional subsidy rules before committing."
      ),
      change: honest
        ? `An option to discuss with your agronomist: it changes ${changedYears(rot, base)} of the ${n} years, with more ${names(fresh)}`
        : `No option here comes out clearly above the current rotation on ${kind === "water" ? "climate fit" : "soil cover and nitrogen"}; this is the closest, to discuss with your agronomist`,
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
      evidenceGrade: "Your current practice",
      priorityFit: fit(base, baseScore),
      indicators: indicators(baseScore),
      closeCall: null,
      why: lines(
        declared === "other"
          ? 'You chose "other or not sure", so this card assumes wheat every year. The comparison is only as good as that assumption.'
          : `The current rotation is given as ${label(base).toLowerCase()}. The other two options are measured against it.`,
        stressLine
      ),
      evidence: lines(
        f.greenness,
        f.drought,
        f.bare &&
          f.bare +
            (hasFallow && f.bareCount === 0 && f.clearCount >= 4
              ? " The declared rotation has a fallow year every fourth summer, so the declaration is worth checking."
              : !hasFallow && f.approximation
                ? f.approximation
                : "") +
            f.unclear
      ),
      benefits: lines(
        "No new machinery, seed or buyers are needed.",
        hasFallow
          ? "The fallow year stores some water for the first wheat, though local research (Suleimenov and Akshalov) suggests only 5 to 15% more than standing stubble."
          : CROPS[W].marketNote
      ),
      gaps: lines(
        "Which crop and variety was sown each year is not visible from orbit: the rotation is the one given for the field.",
        "A summer with little green can be a fallow year or a failed crop; the satellite curve alone cannot tell them apart.",
        hasFallow
          ? "How much water the fallow year really stored for the wheat after it; weed seeds, soil-borne disease and insects."
          : "Root disease and weed seeds carried from one wheat crop to the next; insect pressure.",
        ratingsGap(base)
      ),
      localReview: lines(
        hasFallow
          ? "Bare fallow leaves the soil open to wind and water for a whole summer: look for blown soil and washed channels."
          : "Root diseases, weeds and insects can build up when wheat follows wheat: ask how the last few crops looked at harvest.",
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
      evidenceGrade: w.evidenceGrade,
      priorityFit: w.priorityFit,
      indicators: w.indicators,
      closeCall: w.closeCall,
      why: lines(
        stressLine,
        `${w.change}${!water.honest ? "" : w.indicators[0].value - baseScore.climateFit < 0.02 ? "; on this weather record its edge over the current rotation on climate fit is small" : "; taken together, its crops are rated as coping better with drought and heat than the current rotation's"}.`,
        "Sunflower and rapeseed are left out: both draw heavily on soil water and can leave the ground dry for the next crop.",
        priorityLine("water")
      ),
      evidence: lines(f.worst, f.greenness, f.modis, f.drought),
      benefits: w.benefits,
      gaps: lines(
        w.cropGap,
        "Water stored deep in the soil after winter, snow depth and stubble height on this field.",
        "Rain and heat come from a regional weather grid, not from this field.",
        w.gap
      ),
      localReview: w.localReview,
    },
    {
      kind: "soil",
      title: "Soil-restoring shift",
      rotation: s.rotation,
      rotationLabel: s.rotationLabel,
      evidenceGrade: s.evidenceGrade,
      priorityFit: s.priorityFit,
      indicators: s.indicators,
      closeCall: s.closeCall,
      why: lines(
        noCoverGain
          ? COVERED
          : hasFallow &&
              "Bare fallow leaves the soil uncovered for a whole summer, one year in four.",
        `${s.change}${!soil.honest ? "" : noCoverGain ? ", and it comes out higher on the soil cover and nitrogen bar through nitrogen alone" : ", and it comes out higher than the current rotation on soil cover and nitrogen"}.`,
        sameCrops(soil.ranked[0].rot, TRIAL_ROT)
          ? cap(TRIAL_LINE)
          : `For comparison, not this option: ${TRIAL_LINE}`,
        priorityLine("soil")
      ),
      evidence: lines(f.bare && f.bare + f.unclear, f.soil),
      benefits: s.benefits,
      gaps: lines(
        s.cropGap,
        "Salt-affected patches, acidity, phosphorus and nitrate need a soil test; wind erosion, crusting and surface stubble need a field walk.",
        analysis.soil
          ? "The soil figures shown come from a global soil model, not from samples taken on this field."
          : "Soil organic matter is not measured from orbit.",
        s.gap
      ),
      localReview: s.localReview,
    },
  ]
}
