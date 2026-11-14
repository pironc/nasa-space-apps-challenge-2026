// Self-check for src/lib/rotation.ts. Run: node frontend/scripts/check-rotation.ts
// Fails if a card contradicts its own bars, proposes a thirsty crop for water, or stops responding to the data.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { CROPS } from "../src/data/crop-catalogue.ts"
import type { CropId } from "../src/data/crop-catalogue.ts"
import type {
  FieldAnalysis,
  Priorities,
  Strategy,
  StrategyInput,
  StressProfile,
} from "../src/lib/analysis.ts"
import { compareStrategies, DEFAULT_PRIORITIES } from "../src/lib/rotation.ts"

const sample = JSON.parse(
  readFileSync(
    new URL("../public/presets/kostanay-fyodorov.json", import.meta.url),
    "utf8"
  )
) as FieldAnalysis
// The same field with nothing but a profile: every evidence line must drop out cleanly.
const empty: FieldAnalysis = {
  ...sample,
  seasons: [],
  baseline: null,
  modis: null,
  soil: null,
  climate: { ...sample.climate, seasons: [], droughtYears: [] },
}

const PROFILES: Record<string, Omit<StressProfile, "years">> = {
  "dry-hot steppe": {
    rainMeanMm: 150,
    water: 0.6,
    heat: 0.55,
    frost: 0.05,
    bare: 0.25,
  },
  moderate: { rainMeanMm: 199, water: 0.3, heat: 0.3, frost: 0.05, bare: 0.1 }, // 199 mm: just under the old hard 200 mm gate
  "wet-cool forest-steppe": {
    rainMeanMm: 250,
    water: 0.12,
    heat: 0.08,
    frost: 0.1,
    bare: 0,
  },
}
const PRIORITIES: Record<string, Priorities> = {
  even: DEFAULT_PRIORITIES,
  water: { water: 1, soil: 0, income: 0 },
  soil: { water: 0, soil: 1, income: 0 },
  income: { water: 0, soil: 0, income: 1 },
}
const DECLARED = ["fwwb", "wwww", "other"] as const

const run = (
  profile: string,
  declared: StrategyInput["declared"],
  priorities: Priorities,
  drier: number,
  analysis = sample
) =>
  compareStrategies({
    analysis: {
      ...analysis,
      profile: { ...PROFILES[profile], years: sample.profile.years },
    },
    declared,
    priorities,
    drier,
  })
const value = (s: Strategy, key: string) =>
  s.indicators.find((i) => i.key === key)!.value
const crops = (s: Strategy) => [...s.rotation].sort().join()
const hardy = (s: Strategy) =>
  s.rotation.filter((id) => ["millet", "flax", "barley"].includes(id)).length
/** Years in crops the catalogue rates below 4 of 5 for drought tolerance (wheat, oats, pea, rapeseed). */
const tender = (s: Strategy) =>
  s.rotation.filter((id) => CROPS[id as CropId].droughtTol < 4).length
const SHORT: Record<string, string> = {
  spring_wheat: "wheat",
  field_pea: "pea",
  sweet_clover: "clover",
}
const short = (s: Strategy) => s.rotation.map((id) => SHORT[id] ?? id).join("-")

const table: Record<string, string>[] = []
let cases = 0
let closeCalls = 0
for (const profile of Object.keys(PROFILES))
  for (const declared of DECLARED)
    for (const [prName, pr] of Object.entries(PRIORITIES))
      for (const drier of [0, 1])
        for (const analysis of [sample, empty]) {
          const where = `${profile} / ${declared} / ${prName} / drier ${drier}${analysis === empty ? " / empty" : ""}`
          const cards = run(profile, declared, pr, drier, analysis)
          const [base, water, soil] = cards
          cases++

          assert.deepEqual(
            cards.map((c) => c.kind),
            ["baseline", "water", "soil"],
            where
          )
          assert.deepEqual(
            cards.map((c) => c.title),
            [
              "Keep the current rotation",
              "Climate and water-resilient shift",
              "Soil-restoring shift",
            ],
            where
          )
          assert.deepEqual(
            base.rotation,
            declared === "fwwb"
              ? ["fallow", "spring_wheat", "spring_wheat", "barley"]
              : Array(4).fill("spring_wheat"),
            where
          )
          if (declared === "other")
            assert.match(base.why.join(" "), /assumes wheat every year/, where)

          // The labels cannot contradict the bars.
          assert.ok(
            value(soil, "soil") > value(base, "soil"),
            `soil card must beat the baseline on soil: ${where}`
          )
          assert.ok(
            !soil.rotation.includes("fallow"),
            `soil card must not contain bare fallow: ${where}`
          )
          assert.ok(
            value(water, "climateFit") > value(base, "climateFit"),
            `water card must beat the baseline on climate fit: ${where}`
          )
          assert.notEqual(
            crops(water),
            crops(soil),
            `water and soil cards must differ: ${where}`
          )
          for (const id of water.rotation)
            assert.ok(
              CROPS[id as CropId].waterUse < 4,
              `${id} is too thirsty for a water card: ${where}`
            )
          if (profile.startsWith("dry"))
            for (const c of cards)
              assert.ok(
                !c.rotation.includes("rapeseed"),
                `rapeseed in the dry steppe: ${where}`
              )

          for (const c of cards) {
            const lists = {
              why: c.why,
              evidence: c.evidence,
              benefits: c.benefits,
              gaps: c.gaps,
              localReview: c.localReview,
            }
            assert.ok(
              c.why.length &&
                c.evidence.length + c.benefits.length &&
                c.gaps.length &&
                c.localReview.length,
              `empty text on ${c.kind}: ${where}`
            )
            for (const [name, list] of Object.entries(lists))
              assert.ok(
                list.length <= 4,
                `${name} has more than 4 lines on ${c.kind}: ${where}`
              )
            const text = [
              c.rotationLabel,
              c.closeCall ?? "",
              ...c.indicators.map((i) => i.label),
              ...Object.values(lists).flat(),
            ].join("\n")
            assert.doesNotMatch(
              text,
              /NaN|undefined|null|Infinity|\d\.\d{2,}|leaf| {2}|, \.| ,/i,
              `bad text on ${c.kind}: ${where}`
            )
            for (const i of c.indicators) {
              assert.ok(
                i.value >= 0 && i.value <= 1,
                `${i.key} out of range: ${where}`
              )
              assert.equal(
                i.level,
                i.value < 0.4 ? "low" : i.value < 0.7 ? "medium" : "high",
                where
              )
            }
            if (c.closeCall)
              assert.match(
                c.closeCall,
                /^[A-Z][a-z ,()]+ scored almost the same\.$/,
                where
              )
            if (c.closeCall) closeCalls++
            // Replacing bare fallow always carries its trade-off; trial numbers always carry their source.
            if (
              c.kind !== "baseline" &&
              base.rotation.includes("fallow") &&
              !c.rotation.includes("fallow")
            )
              assert.match(
                c.localReview.join(" "),
                /uses water that bare fallow would have stored/,
                `missing fallow trade-off on ${c.kind}: ${where}`
              )
            for (const line of Object.values(lists).flat())
              if (/wheat after (oats|lentil|pea)/.test(line))
                assert.match(
                  line,
                  /Barayev centre trial, Shortandy, 2018 to 2020/,
                  where
                )
          }
          if (analysis === empty)
            for (const c of cards)
              assert.equal(
                c.evidence.length,
                0,
                `evidence invented without data on ${c.kind}: ${where}`
              )
          else if (declared !== "other")
            table.push({
              profile,
              declared,
              priorities: prName,
              drier: String(drier),
              water: short(water),
              soil: short(soil),
            })
        }

// Responds to the data: profile, what-if, priorities, declared rotation.
const pick = (
  profile: string,
  declared: StrategyInput["declared"],
  pr: Priorities,
  drier: number
) => run(profile, declared, pr, drier)
const profiles = Object.keys(PROFILES)
assert.ok(
  profiles.some(
    (p) =>
      crops(pick(p, "wwww", DEFAULT_PRIORITIES, 0)[1]) !==
      crops(pick(p, "wwww", DEFAULT_PRIORITIES, 1)[1])
  ),
  "the water card must change between drier 0 and drier 1 for at least one profile"
)
for (const p of profiles)
  for (const d of ["fwwb", "wwww"] as const)
    for (const pr of Object.values(PRIORITIES))
      assert.ok(
        tender(pick(p, d, pr, 1)[1]) <= tender(pick(p, d, pr, 0)[1]),
        `drier must not add drought-sensitive years to the water card: ${p} / ${d}`
      )
assert.ok(
  profiles.some(
    (p) =>
      hardy(pick(p, "wwww", DEFAULT_PRIORITIES, 1)[1]) >
      hardy(pick(p, "wwww", DEFAULT_PRIORITIES, 0)[1])
  ),
  "drier must move the water card towards millet, flax or barley for at least one profile"
)
for (const d of ["fwwb", "wwww"] as const) {
  const [, dryWater, drySoil] = pick(profiles[0], d, DEFAULT_PRIORITIES, 0)
  const [, wetWater, wetSoil] = pick(profiles[2], d, DEFAULT_PRIORITIES, 0)
  assert.notEqual(
    crops(dryWater),
    crops(wetWater),
    `water card identical in the dry and the wet profile (${d})`
  )
  assert.notEqual(
    crops(drySoil),
    crops(wetSoil),
    `soil card identical in the dry and the wet profile (${d})`
  )
}
assert.ok(
  Object.values(PRIORITIES).some((pr) =>
    pick(profiles[2], "wwww", pr, 0).some((c) =>
      c.rotation.includes("rapeseed")
    )
  ),
  "a wet, cool profile should allow rapeseed"
)
assert.ok(
  profiles.some(
    (p) =>
      new Set(
        Object.values(PRIORITIES).map((pr) =>
          pick(p, "wwww", pr, 0).map(crops).join("|")
        )
      ).size > 1
  ),
  "the cards must respond to the farmer priorities"
)
assert.ok(
  profiles.some(
    (p) =>
      crops(pick(p, "fwwb", DEFAULT_PRIORITIES, 0)[2]) !==
      crops(pick(p, "wwww", DEFAULT_PRIORITIES, 0)[2])
  ),
  "the cards must respond to the declared rotation"
)
// Soft gates: one millimetre either side of the old 200 mm gate changes nothing.
const at = (rainMeanMm: number) =>
  compareStrategies({
    analysis: {
      ...sample,
      profile: { ...sample.profile, ...PROFILES.moderate, rainMeanMm },
    },
    declared: "wwww",
    priorities: DEFAULT_PRIORITIES,
    drier: 0,
  })
assert.deepEqual(
  at(199).map((c) => c.rotation),
  at(201).map((c) => c.rotation),
  "a 2 mm change in mean rain must not flip a card"
)
// The sample field's own numbers reach the cards, and no other number does.
const real = compareStrategies({
  analysis: sample,
  declared: "wwww",
  priorities: DEFAULT_PRIORITIES,
  drier: 0,
})
const cs = sample.climate.seasons
const driest = cs
  .slice(-10)
  .reduce((m, s) => (s.rainMayAugPct < m.rainMayAugPct ? s : m))
assert.ok(
  real[1].evidence
    .join(" ")
    .includes(
      `In ${driest.year}, the driest of the last 10 seasons, May to August rain was ${Math.round(driest.rainMayAugPct)}% of normal`
    )
)
assert.ok(
  real[0].evidence
    .join(" ")
    .includes(
      `${sample.climate.droughtYears.length} of the ${cs.length} seasons from ${cs[0].year} to ${cs.at(-1)!.year}`
    )
)
const known = JSON.stringify(sample).match(/\d+/g)!
for (const line of real.flatMap((c) => c.evidence))
  for (const n of line.replace(/Sentinel-2|\d+ °C/g, "").match(/\d+/g) ?? [])
    assert.ok(
      known.includes(n) ||
        line.includes(`${n}% of its usual peak`) ||
        line.includes(`${n} of the`) ||
        line.includes(`last ${n} seasons`),
      `"${n}" is not in the analysis: ${line}`
    )
for (const c of Object.values(CROPS))
  if (c.marketNote)
    assert.match(c.marketNote, /\(as of 2025\)$|\(as of 2025\)\.$/, c.name)

console.table(table)
console.log(
  `check-rotation: ${cases} cases passed, ${closeCalls} close calls named`
)
