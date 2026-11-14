// STUB: fixed output so the UI can be built. The real engine replaces this file
// and must keep the exported names and signatures.
import type { Priorities, Strategy, StrategyInput } from "@/lib/analysis"

export const DEFAULT_PRIORITIES: Priorities = { water: 0.5, soil: 0.5, income: 0.5 }

const indicators = (v: number[]): Strategy["indicators"] =>
  (["climateFit", "soil", "pestBreak", "market", "productivity"] as const).map((key, i) => ({
    key,
    label: ["Climate fit", "Soil cover and nitrogen", "Pest and disease break", "Market access", "Relative output"][i],
    value: v[i],
    level: v[i] < 0.4 ? "low" : v[i] < 0.7 ? "medium" : "high",
  }))

export function compareStrategies(input: StrategyInput): Strategy[] {
  void input
  return [
    {
      kind: "baseline",
      title: "Keep the current rotation",
      rotation: ["spring_wheat", "spring_wheat", "spring_wheat", "spring_wheat"],
      rotationLabel: "Wheat every year",
      indicators: indicators([0.55, 0.6, 0.1, 1, 0.5]),
      why: ["This is what the field does today; the other two options are measured against it."],
      evidence: ["Peak greenness in 2021 was 73% of this field's usual."],
      benefits: ["No new machinery, seed or buyers needed."],
      gaps: ["The crop actually sown each year is not visible from orbit."],
      localReview: ["Disease and weed pressure after several wheat crops in a row."],
      closeCall: null,
    },
    {
      kind: "water",
      title: "Spread the water risk",
      rotation: ["spring_wheat", "flax", "spring_wheat", "barley"],
      rotationLabel: "Wheat, flax, wheat, barley",
      indicators: indicators([0.7, 0.55, 0.6, 0.85, 0.6]),
      why: ["3 of the last 10 seasons here were short of water before flowering."],
      evidence: ["May to August rain in 2021 was 42% of the 30-year normal."],
      benefits: ["Flax and barley need less water than wheat and mature earlier."],
      gaps: ["Water stored at depth after winter is not measured."],
      localReview: ["Herbicide carry-over from earlier wheat can damage flax."],
      closeCall: "Wheat, millet, wheat, flax scored almost the same.",
    },
    {
      kind: "soil",
      title: "Rebuild the soil",
      rotation: ["oats", "spring_wheat", "spring_wheat", "barley"],
      rotationLabel: "Oats, wheat, wheat, barley",
      indicators: indicators([0.6, 0.8, 0.5, 0.6, 0.55]),
      why: ["The field lay bare for a whole summer in 2 of 9 observed seasons."],
      evidence: ["Greenness stayed below 0.25 from late June to late August in 2023."],
      benefits: ["A sown crop in place of bare fallow keeps the soil covered against wind."],
      gaps: ["Soil organic matter and nutrient levels need a soil test."],
      localReview: ["Wheat after oats yielded about 6% less than after fallow in the Shortandy trial (2018 to 2020)."],
      closeCall: null,
    },
  ]
}
