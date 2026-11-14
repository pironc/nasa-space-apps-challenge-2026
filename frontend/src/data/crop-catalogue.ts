// Crop catalogue for the northern Kazakhstan grain belt (Kostanay, Akmola, North Kazakhstan).
// Ported from docs/research/kazakhstan-agronomy/crop_catalogue.draft.json (drafted 2026-11-14),
// keeping only what lib/rotation.ts reads. DRAFT for agronomist review: every value whose
// `judgement` flag is true is the drafter's own ranking, not a sourced number.
// Scales: 1 = poor/low, 5 = good/high. waterUse: 1 = leaves most water for the next crop, 5 = dries the profile.

export type Crop = {
  name: string
  /** Short name used in rotation labels. */
  label: string
  group:
    "cereal" | "cereal_c4" | "oilseed" | "pulse" | "green_manure" | "fallow"
  waterUse: number
  droughtTol: number
  heatTol: number
  /** 0 to 1: how much a late-spring or early-autumn frost hurts. */
  frostSens: number
  /** Dryland nitrogen fixed, kg/ha. */
  nFix: [number, number]
  /** Residue left to cover the soil, 0 to 5. */
  residue: number
  /** Market access rank, 0 to 5. Never a price. */
  market: number
  /** Card sentence behind the market rank; date-stamped because markets move fast. */
  marketNote: string
  /** National yield range, t/ha. null where there is no grain to weigh. */
  yieldTHa: [number, number] | null
  /** Yield of the wheat that follows this crop, wheat after bare fallow = 1.00. */
  nextWheat: number
  judgement: Record<
    | "waterUse"
    | "droughtTol"
    | "heatTol"
    | "frostSens"
    | "residue"
    | "market"
    | "nFix"
    | "yieldTHa"
    | "nextWheat",
    boolean
  >
  /** Keys into SOURCES, as in the draft. */
  source: string
}

export const SOURCES = {
  FAO_T6_T14:
    "https://www.fao.org/4/s2022e/s2022e07.htm (FAO Irrigation Water Management Training Manual 3: Table 6 growing period, Table 14 crop water need; values are for unstressed, irrigated crops)",
  FAO56_T22:
    "https://www.fao.org/4/x0490e/x0490e0e.htm (FAO-56 Table 22 maximum effective rooting depth)",
  FAOSTAT:
    "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Asia.zip (Kazakhstan national yield, min-max 2015-2024)",
  BARAYEV_DIV:
    "https://baraev.kz/scientific_articles/523-diversification-increases-the-efficiency-of-arable-land.html (long-term trial means, Akmola)",
  BARAYEV_POSTER:
    "https://www.fao.org/fileadmin/user_upload/GSP/GSOIL4N/GSOIL4N-Posters/ID_201.pdf (wheat yield by predecessor 2018-2020)",
  ALBERTA_GM:
    "https://www1.agric.gov.ab.ca/$department/deptdocs.nsf/all/faq7979 (N fixed under irrigation, lb N/ac; converted x1.12)",
  USDA_PSD:
    "https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip and psd_oilseeds_csv.zip",
  FAS_2026:
    "https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Grain%20and%20Feed%20Annual_Astana(Nur-Sultan)_Kazakhstan%20-%20Republic%20of_KZ2026-0007.pdf",
  AREA_2025:
    "https://agroreview.com/en/newsen/crops/kazakhstan-increased-production-oilseeds-and/ (2025 areas, secondary report of Bureau of National Statistics data)",
}

export const NEXT_WHEAT_SOURCE =
  "fallow/oats/lentil/mustard: Barayev poster 2018-2020 (21.4, 20.1, 18.8-18.9 c/ha). field_pea: Suleimenov et al. 2005 (fallow advantage 20-25% over oats and dry pea). second wheat: USDA IPAD 2009 (15-20% drop). Others are judgement."

// All 1-5 ranks are judgement (README: "days, ranks and dryland N are judgement"); the market rank is the
// drafter's reading of the sourced market facts. Overrides mark the sourced or the extra-judgement cells.
const j = (over: Partial<Crop["judgement"]> = {}): Crop["judgement"] => ({
  waterUse: true,
  droughtTol: true,
  heatTol: true,
  frostSens: true,
  residue: true,
  market: true,
  nFix: false,
  yieldTHa: false,
  nextWheat: true,
  ...over,
})

export const CROPS = {
  spring_wheat: {
    name: "Spring wheat (bread)",
    label: "wheat",
    group: "cereal",
    waterUse: 3,
    droughtTol: 3,
    heatTol: 2,
    frostSens: 0,
    nFix: [0, 0],
    residue: 4,
    market: 5,
    marketNote:
      "Wheat can be sold in every district, to elevators and through the state purchase scheme, though at a low price (as of 2025).",
    yieldTHa: [0.92, 1.58],
    nextWheat: 0.83,
    judgement: j({ nextWheat: false }),
    source: "FAO_T6_T14; FAO56_T22; USDA_PSD; FAS_2026",
  },
  durum: {
    name: "Durum wheat",
    label: "durum wheat",
    group: "cereal",
    waterUse: 3,
    droughtTol: 3,
    heatTol: 3,
    frostSens: 0,
    nFix: [0, 0],
    residue: 4,
    market: 3,
    marketNote:
      "Durum is a niche premium crop with heavy quality discounts after a wet harvest (as of 2025).",
    yieldTHa: [0.9, 1.5],
    nextWheat: 0.83,
    judgement: j({ yieldTHa: true, nextWheat: false }),
    source: "FAO_T6_T14; FAO56_T22; FAS March 2026 update (FCC price table)",
  },
  barley: {
    name: "Spring barley",
    label: "barley",
    group: "cereal",
    waterUse: 2,
    droughtTol: 4,
    heatTol: 3,
    frostSens: 0,
    nFix: [0, 0],
    residue: 3,
    market: 4,
    marketNote:
      "Barley has steady feed demand and regular export buyers (as of 2025).",
    yieldTHa: [1.08, 1.71],
    nextWheat: 0.85,
    judgement: j(),
    source: "FAO_T6_T14; FAO56_T22; FAOSTAT; USDA_PSD",
  },
  oats: {
    name: "Oats",
    label: "oats",
    group: "cereal",
    waterUse: 3,
    droughtTol: 2,
    heatTol: 2,
    frostSens: 0.2,
    nFix: [0, 0],
    residue: 4,
    market: 2,
    marketNote:
      "Oats is a small crop mostly fed on the farm, so buyers are few (as of 2025).",
    yieldTHa: [0.79, 1.71],
    nextWheat: 0.94,
    judgement: j({ nextWheat: false }),
    source: "FAO_T6_T14; FAO56_T22; FAOSTAT; BARAYEV_DIV; BARAYEV_POSTER",
  },
  flax: {
    name: "Oilseed flax (linseed)",
    label: "flax",
    group: "oilseed",
    waterUse: 3,
    droughtTol: 4,
    heatTol: 3,
    frostSens: 0.3,
    nFix: [0, 0],
    residue: 2,
    market: 4,
    marketNote:
      "Flax is an established export crop, but its price and sown area swing sharply from year to year (as of 2025).",
    yieldTHa: [0.5, 0.89],
    nextWheat: 0.88,
    judgement: j(),
    source:
      "FAO_T6_T14 (days only); FAO56_T22; FAOSTAT; BARAYEV_DIV; AREA_2025",
  },
  sunflower: {
    name: "Sunflower (early hybrids)",
    label: "sunflower",
    group: "oilseed",
    waterUse: 5,
    droughtTol: 4,
    heatTol: 4,
    frostSens: 0.6,
    nFix: [0, 0],
    residue: 2,
    market: 5,
    marketNote:
      "Sunflower is the largest oilseed, sold mainly to domestic crushers (as of 2025).",
    yieldTHa: [0.76, 1.46],
    nextWheat: 0.75,
    judgement: j(),
    source: "FAO_T6_T14; FAO56_T22; FAOSTAT; USDA_PSD; BARAYEV_DIV",
  },
  rapeseed: {
    name: "Spring rapeseed (canola)",
    label: "rapeseed",
    group: "oilseed",
    waterUse: 4,
    droughtTol: 2,
    heatTol: 1,
    frostSens: 0.4,
    nFix: [0, 0],
    residue: 3,
    market: 4,
    marketNote:
      "Rapeseed is the fastest-growing oilseed and finds buyers readily (as of 2025).",
    yieldTHa: [0.63, 1.95],
    nextWheat: 0.85,
    judgement: j(),
    source: "FAO56_T22; USDA_PSD; BARAYEV_DIV; AREA_2025",
  },
  lentil: {
    name: "Lentil",
    label: "lentil",
    group: "pulse",
    waterUse: 2,
    droughtTol: 4,
    heatTol: 2,
    frostSens: 0.2,
    nFix: [30, 80],
    residue: 1,
    market: 4,
    marketNote:
      "Lentil sells readily, but most exports go to one country, Turkey, so the price falls when supply is high (as of 2025).",
    yieldTHa: [0.74, 1.34],
    nextWheat: 0.88,
    judgement: j({ nFix: true, nextWheat: false }),
    source:
      "FAO_T6_T14 (days only); FAO56_T22; FAOSTAT; ALBERTA_GM; BARAYEV_DIV; FAS_2026; AREA_2025",
  },
  field_pea: {
    name: "Field pea",
    label: "pea",
    group: "pulse",
    waterUse: 2,
    droughtTol: 3,
    heatTol: 2,
    frostSens: 0.2,
    nFix: [40, 100],
    residue: 2,
    market: 3,
    marketNote: "Pea has a thinner network of buyers than lentil (as of 2025).",
    yieldTHa: [0.95, 1.35],
    nextWheat: 0.82,
    judgement: j({ nFix: true, nextWheat: false }),
    source: "FAO_T6_T14; FAO56_T22; FAOSTAT; ALBERTA_GM; BARAYEV_DIV; FAS_2026",
  },
  chickpea: {
    name: "Chickpea",
    label: "chickpea",
    group: "pulse",
    waterUse: 3,
    droughtTol: 5,
    heatTol: 4,
    frostSens: 0.6,
    nFix: [20, 60],
    residue: 1,
    market: 2,
    marketNote:
      "Chickpea is a tiny crop here, with few buyers and little local seed (as of 2025).",
    yieldTHa: [0.36, 1.01],
    nextWheat: 0.86,
    judgement: j({ nFix: true }),
    source: "FAO56_T22; FAOSTAT; ALBERTA_GM; BARAYEV_DIV",
  },
  millet: {
    name: "Proso millet",
    label: "millet",
    group: "cereal_c4",
    waterUse: 1,
    droughtTol: 5,
    heatTol: 5,
    frostSens: 1,
    nFix: [0, 0],
    residue: 3,
    market: 2,
    marketNote:
      "Millet has only a small domestic market, for groats and feed (as of 2025).",
    yieldTHa: [0.79, 1.1],
    nextWheat: 0.9,
    judgement: j(),
    source: "FAO_T6_T14; FAO56_T22; FAOSTAT; USDA_PSD; BARAYEV_DIV",
  },
  sweet_clover: {
    name: "Sweet clover green manure (undersown, ploughed down in year 2)",
    label: "sweet clover (green manure)",
    group: "green_manure",
    waterUse: 5,
    droughtTol: 5,
    heatTol: 4,
    frostSens: 0,
    nFix: [60, 120],
    residue: 5,
    market: 1,
    marketNote:
      "Sweet clover is ploughed in as green manure, so there is no crop to sell from that year (as of 2025).",
    yieldTHa: null,
    nextWheat: 0.92,
    judgement: j({ nFix: true }),
    source: "ALBERTA_GM; BARAYEV_DIV",
  },
  fallow: {
    name: "Bare summer fallow",
    label: "fallow",
    group: "fallow",
    waterUse: 0,
    droughtTol: 5,
    heatTol: 5,
    frostSens: 0,
    nFix: [0, 0],
    residue: 0,
    market: 0,
    marketNote: "",
    yieldTHa: null,
    nextWheat: 1,
    judgement: j({ nextWheat: false }),
    source: "USDA IPAD 2009 (archived); Akshalov, Barayev centre",
  },
} satisfies Record<string, Crop>

export type CropId = keyof typeof CROPS
