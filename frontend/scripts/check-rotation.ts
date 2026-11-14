// Self-check for src/lib/rotation.ts. Run: node frontend/scripts/check-rotation.ts [preset.json]
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
import {
  compareStrategies,
  cropLabel,
  DEFAULT_PRIORITIES,
  rateRotation,
} from "../src/lib/rotation.ts"

const sample = JSON.parse(
  readFileSync(
    process.argv[2] ??
      new URL("../public/presets/kostanay-fyodorov.json", import.meta.url),
    "utf8"
  )
) as FieldAnalysis
// Sentences the analysis wrote itself (they carry NDVI to two decimals); the engine quotes them whole.
const quoted = sample.seasons
  .flatMap((s) => [...s.verdicts.map((v) => v.detail), s.explanation ?? ""])
  .filter(Boolean)
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

const CEREALS = ["spring_wheat", "durum", "barley", "oats", "millet", "fallow"]
const SOURCED =
  /^(Sentinel-2 \(ESA\)|NASA POWER|NASA MODIS|ISRIC SoilGrids): [a-z]/
const SAME =
  "The same option holds at these priorities as with all three at medium."
const htc = sample.climate.normals.htc.toFixed(2)

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

          // The labels cannot contradict the bars: 0.05 clear on the soil bar, or the card says it found nothing.
          const soilWhy = soil.why.join(" ")
          assert.ok(
            value(soil, "soil") >= value(base, "soil") + 0.05 ||
              /No option here comes out clearly above/.test(soilWhy),
            `soil card must clear the baseline by 0.05 on soil or say it does not: ${where}`
          )
          assert.ok(
            soil.rotation.filter((id) => CROPS[id as CropId].residue <= 2)
              .length <= 1,
            `more than one thin-residue crop on the soil card: ${where}`
          )
          // Wheat every year already leaves as much residue as any option: the card must not promise more cover.
          assert.equal(
            soilWhy.includes(
              "Your rotation already keeps residue on the soil. The gains available are nitrogen and a break from wheat diseases, not soil cover."
            ),
            declared !== "fwwb",
            `soil-cover honesty line: ${where}`
          )
          assert.ok(
            soil.why.includes(
              (crops(soil) === "barley,oats,spring_wheat,spring_wheat"
                ? "Oats"
                : "For comparison, not this option: oats") +
                ", wheat, wheat, barley is the one rotation measured locally: in the Barayev centre trial, Shortandy, 2018 to 2020, it gave about 27% more grain per rotation hectare than the fallow rotation."
            ),
            `soil card must carry the local trial line, marked as a comparison unless it is the pick: ${where}`
          )
          // The stress sentence says what it measures and how dry the normal is; it never calls the stress "low".
          for (const c of [base, water]) {
            assert.ok(
              c.why.some(
                (l) =>
                  l.includes(
                    "how often and how far May to August rain falls short of its own normal"
                  ) &&
                  l.includes(
                    `hydrothermal coefficient ${htc}, where about 1 is enough moisture`
                  ) &&
                  l.includes("The normal itself is dry") === +htc < 1
              ),
              `stress sentence on ${c.kind}: ${where}`
            )
            assert.doesNotMatch(
              c.why.find((l) => l.includes("how often and how far"))!,
              /\blow\b|stress/,
              `the ratings are small, moderate or large, never "low stress": ${where}`
            )
          }
          // Priorities: a fit bar on every card, and a sentence that only claims a change when the pick changed.
          const usual = run(
            profile,
            declared,
            DEFAULT_PRIORITIES,
            drier,
            analysis
          )
          for (const [i, c] of cards.entries()) {
            assert.ok(
              c.priorityFit > 0 && c.priorityFit <= 1,
              `priorityFit out of range on ${c.kind}: ${where}`
            )
            const said = c.why.filter(
              (l) => l === SAME || l.startsWith("Your priorities changed")
            )
            assert.deepEqual(
              said,
              pr === DEFAULT_PRIORITIES || c.kind === "baseline"
                ? []
                : c.rotation.join() === usual[i].rotation.join()
                  ? [SAME]
                  : [
                      `Your priorities changed this option: with all three at medium it would be ${usual[i].rotationLabel.toLowerCase()}.`,
                    ],
              `priority sentence on ${c.kind}: ${where}`
            )
          }
          assert.equal(base.evidenceGrade, "Your current practice", where)
          for (const c of [water, soil]) {
            assert.equal(
              c.evidenceGrade,
              crops(c) === "barley,oats,spring_wheat,spring_wheat"
                ? "Local rotation trial"
                : c.rotation.some((id) =>
                      ["millet", "sweet_clover"].includes(id)
                    )
                  ? "Judgement"
                  : "Each crop trialled locally; this sequence is not",
              `evidence grade on ${c.kind}: ${where}`
            )
            assert.match(
              c.why.join(" "),
              /to discuss with your agronomist/,
              `${c.kind} card must be an option to discuss: ${where}`
            )
            assert.ok(
              c.gaps.length === 4 &&
                c.rotation.some(
                  (id) =>
                    id !== "spring_wheat" &&
                    c.gaps[0].includes(
                      CROPS[id as CropId].label.replace(/ \(.*/, "")
                    )
                ),
              `first gap line must be about a crop this card proposes: ${where}`
            )
            // Carry-over and return intervals are specific to the crops on the card.
            const review = c.localReview.join(" ")
            const sprayed = c.rotation.filter(
              (id, i) =>
                ["pulse", "oilseed"].includes(CROPS[id as CropId].group) &&
                CROPS[c.rotation.at(i - 1) as CropId].group.startsWith("cereal")
            )
            for (const id of sprayed)
              assert.ok(
                review.includes("check which herbicides were used") &&
                  review.includes(`can injure ${CROPS[id as CropId].label}`),
                `no herbicide carry-over line for ${id} on ${c.kind}: ${where}`
              )
            assert.equal(
              review.includes(
                "Flax every 4 years is shorter than the usual 5-year gap"
              ),
              c.rotation.includes("flax"),
              `flax return interval on ${c.kind}: ${where}`
            )
          }
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
            const text = quoted
              .reduce(
                (t, q) => t.replaceAll(q, "(quoted)"),
                [
                  c.rotationLabel,
                  c.evidenceGrade,
                  c.closeCall ?? "",
                  ...c.indicators.map((i) => i.label),
                  ...Object.values(lists).flat(),
                ].join("\n")
              )
              .replaceAll(`hydrothermal coefficient ${htc}`, "(the normal)") // two decimals, as the Climate tab shows it
            assert.doesNotMatch(
              text,
              /NaN|undefined|null|Infinity|\d\.\d{2,}|leaf| {2}|, \.| ,/i,
              `bad text on ${c.kind}: ${where}`
            )
            // Never-say list: no verdict on causes, no advice, no money result.
            assert.doesNotMatch(
              text,
              /caused|management problem|monoculture|you should|recommend|profit|income|alert|LOW_CANOPY|canopy was drier|the 2012 drought|plough|shifted the weights|rotation not/i,
              `forbidden wording on ${c.kind}: ${where}`
            )
            assert.ok(
              value(c, "pestBreak") <=
                (c.rotation.every((id) => CEREALS.includes(id)) ? 0.5 : 0.8),
              `disease break above its cap (0.8, or 0.5 for cereals only) on ${c.kind}: ${where}`
            )
            for (const line of c.evidence)
              assert.match(
                line,
                SOURCED,
                `evidence line without its source: ${where}`
              )
            // Jargon is glossed where it appears.
            for (const line of Object.values(lists).flat()) {
              if (line.includes("inoculant"))
                assert.match(
                  line,
                  /inoculant (\(seed-applied bacteria\)|strain \(the bacteria)/,
                  where
                )
              if (line.includes("sulfonylurea"))
                assert.match(
                  line,
                  /sulfonylureas \(a common group of cereal herbicides\)/,
                  where
                )
            }
            if (
              c.rotation.filter((id) =>
                [
                  "field_pea",
                  "lentil",
                  "chickpea",
                  "rapeseed",
                  "sunflower",
                ].includes(id)
              ).length > 1
            ) {
              assert.ok(
                value(c, "pestBreak") < 0.7,
                `two white-mould hosts must not score high on ${c.kind}: ${where}`
              )
              assert.match(c.localReview.join(" "), /Sclerotinia/, where)
            }
            assert.deepEqual(
              c.indicators.slice(2).map((i) => i.label),
              [
                "Break from wheat diseases and weeds",
                "Market access",
                "Relative output (no unit)",
              ],
              where
            )
            assert.match(
              c.gaps.join(" "),
              /relative ratings with no unit.*does not replace scouting/,
              `${c.kind} must say the bars have no unit and do not replace scouting: ${where}`
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
/** One bar of any rotation, straight from the scorer. */
const bar = (rot: string[], key: string, profile = "moderate") =>
  rateRotation(rot, { ...PROFILES[profile], years: sample.profile.years }).find(
    (i) => i.key === key
  )!.value
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
// The rapeseed gate: open in a wet, cool profile, shut in the dry steppe. (At Shortandy trial yields it rarely wins a card.)
assert.ok(
  bar(["rapeseed", "fallow", "fallow", "fallow"], "climateFit", profiles[2]) >
    0.5
)
assert.equal(
  bar(["rapeseed", "fallow", "fallow", "fallow"], "climateFit", profiles[0]),
  0
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
      `NASA POWER: in ${driest.year}, the driest of the last 10 seasons, May to August rain was ${Math.round(driest.rainMayAugPct)}% of normal`
    )
)
assert.ok(
  real[0].evidence
    .join(" ")
    .includes(
      `NASA POWER: the driest fifth of seasons since ${cs[0].year} by rain set against heat (regional grid): ${sample.climate.droughtYears.join(", ")}. A May to August total can hide a dry June and July.`
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

// The predecessor effect reaches every crop: barley after sunflower loses output, not only wheat.
assert.ok(
  bar(["sunflower", "barley", "fallow", "fallow"], "productivity") <
    bar(["sunflower", "fallow", "barley", "fallow"], "productivity") - 0.01,
  "barley straight after sunflower must lose output against barley after fallow"
)
assert.ok(
  bar(
    ["rapeseed", "oats", "fallow", "fallow"],
    "productivity",
    "wet-cool forest-steppe"
  ) <
    bar(
      ["rapeseed", "fallow", "oats", "fallow"],
      "productivity",
      "wet-cool forest-steppe"
    ) -
      0.01,
  "oats straight after rapeseed must lose output against oats after fallow"
)
// Local trial yields, not the national range: sunflower no longer out-weighs barley.
assert.ok(
  bar(["sunflower", "fallow", "fallow", "fallow"], "productivity") <
    bar(["barley", "fallow", "fallow", "fallow"], "productivity")
)
// Disease break: capped at 0.8, and two white-mould hosts two years apart never score high.
for (const profile of Object.keys(PROFILES)) {
  assert.ok(
    bar(
      ["field_pea", "spring_wheat", "rapeseed", "spring_wheat"],
      "pestBreak",
      profile
    ) < 0.7,
    "pea and rapeseed two years apart must not score high on the disease break"
  )
  for (const rot of [
    ["lentil", "millet", "flax", "barley"],
    ["field_pea", "spring_wheat", "oats", "spring_wheat"],
    ["oats", "spring_wheat", "spring_wheat", "barley"],
  ])
    assert.ok(bar(rot, "pestBreak", profile) <= 0.8, rot.join())
}
// Cereals only is not a disease break: wheat with barley or oats never reads above medium, and a pulse year beats it.
for (const profile of Object.keys(PROFILES)) {
  for (const rot of [
    ["spring_wheat", "barley", "spring_wheat", "barley"],
    ["oats", "spring_wheat", "barley", "millet"],
    ["fallow", "barley", "oats", "barley"],
  ])
    assert.ok(bar(rot, "pestBreak", profile) <= 0.5, rot.join())
  assert.ok(
    bar(
      ["spring_wheat", "lentil", "spring_wheat", "barley"],
      "pestBreak",
      profile
    ) >
      bar(
        ["spring_wheat", "barley", "spring_wheat", "barley"],
        "pestBreak",
        profile
      )
  )
}
// The fit bar moves on all three cards whenever any one priority moves, on the real field.
for (const declared of ["fwwb", "wwww"] as const)
  for (const key of ["water", "soil", "income"] as const) {
    const fits = [0, 0.5, 1].map((v) =>
      compareStrategies({
        analysis: sample,
        declared,
        priorities: { ...DEFAULT_PRIORITIES, [key]: v },
        drier: 0,
      }).map((c) => c.priorityFit)
    )
    for (const i of [0, 1, 2])
      assert.ok(
        Math.abs(fits[0][i] - fits[1][i]) > 0.001 &&
          Math.abs(fits[2][i] - fits[1][i]) > 0.001,
        `priorityFit of card ${i} does not move with ${key} (${declared}): ${fits.map((f) => f[i].toFixed(4))}`
      )
  }
assert.equal(cropLabel("field_pea"), "Pea")
assert.equal(cropLabel("spring_wheat"), "Wheat")
assert.equal(cropLabel("not_a_crop"), "Not a crop")

// Bare and fallow seasons: the declaration wins over the curve, and unclear seasons are left out and counted.
const season = (
  year: number,
  use: FieldAnalysis["seasons"][number]["use"],
  declared: "crop" | "fallow" | null,
  peak: number,
  deficit?: string
): FieldAnalysis["seasons"][number] => ({
  year,
  ndvi: [],
  ndmi: [],
  obs: [],
  use,
  declared,
  peak,
  peakDekad: null,
  verdicts: deficit
    ? [{ type: "VEG_DEFICIT", severity: "warning", title: "", detail: deficit }]
    : [],
  explanation: deficit ? `Weather line for ${year}.` : null,
})
const declaredField: FieldAnalysis = {
  ...sample,
  seasons: [
    season(2019, "cropped", "fallow", 0.7), // declared fallow although the curve looks cropped: counts
    season(2020, "fallow", "crop", 0.3, "Deficit line for 2020."), // declared crop although the curve looks fallow: does not count
    season(2021, "ambiguous", null, 0.2, "Deficit line for 2021."), // unclear: left out, and never the evidence season
    season(2022, "fallow", null, 0.25), // nothing declared: the curve decides
    season(2023, "cropped", null, 0.8),
    season(2024, "unknown", null, 0.5), // unclear: left out
    season(2025, "ambiguous", "crop", 0.4, "Deficit line for 2025."), // declared, so no longer unclear
  ],
}
const seen = compareStrategies({
  analysis: declaredField,
  declared: "fwwb",
  priorities: DEFAULT_PRIORITIES,
  drier: 0,
})
const bareLine = seen[2].evidence.join(" ")
assert.match(
  bareLine,
  /^Sentinel-2 \(ESA\): bare or fallow summers[^.]*: 2 of the 5 seasons with a clear land use \(2019, 2022\)\./
)
assert.match(bareLine, /Seasons left out because[^.]*: 2 \(2021, 2024\)\./)
const greenness = seen[0].evidence.join(" ")
assert.ok(
  greenness.includes(
    "Sentinel-2 (ESA): season 2020. Deficit line for 2020. Weather line for 2020."
  ),
  "the lowest clear cropped season with a deficit is quoted with its weather explanation"
)
assert.ok(!greenness.includes("Deficit line for 2021"))
assert.doesNotMatch(JSON.stringify(seen), /LOW_CANOPY|canopy was drier/)
// Wheat every year beside a fallow season: the card names the seasons and calls the rotation an approximation.
// "Marked", not "you gave": on the demo fields the land use was assumed by the team.
assert.doesNotMatch(seen[0].evidence.join(" "), /approximation/)
for (const declared of ["wwww", "other"] as const) {
  const text = compareStrategies({
    analysis: declaredField,
    declared,
    priorities: DEFAULT_PRIORITIES,
    drier: 0,
  })[0].evidence.join(" ")
  assert.ok(
    text.includes(
      "(2019, 2022). 2019 is marked as fallow and 2022 reads as bare or fallow on the satellite curve, so wheat every year is an approximation of this field."
    ),
    text
  )
  assert.doesNotMatch(text, /worth checking|does not match|you gave/i)
}
// Drought wording comes from the climate record's own drought fields.
const droughtSeason = {
  ...cs.at(-1)!,
  year: 2030,
  rainMayAugPct: 1,
  htcRank: 2,
  htcRankOf: 37,
  drought: "severe" as const,
}
const droughtText = compareStrategies({
  analysis: {
    ...sample,
    climate: {
      ...sample.climate,
      seasons: [...cs, droughtSeason],
      droughtYears: [2012, 2030],
    },
  },
  declared: "wwww",
  priorities: DEFAULT_PRIORITIES,
  drier: 0,
})
  .flatMap((c) => c.evidence)
  .join(" ")
assert.match(
  droughtText,
  /NASA POWER: in 2030, the driest of the last 10 seasons.*was a severe drought: rank 2 of 37 for moisture, 1 being the driest\./
)
assert.match(
  droughtText,
  /NASA POWER: the driest fifth of seasons since \d+ by rain set against heat \(regional grid\): 2012, 2030\. A May to August total can hide a dry June and July\./
)

for (const c of Object.values(CROPS))
  if (c.marketNote)
    assert.match(c.marketNote, /\(as of 2025\)$|\(as of 2025\)\.$/, c.name)

console.table(table)
console.log(
  `check-rotation: ${cases} cases passed, ${closeCalls} close calls named`
)
