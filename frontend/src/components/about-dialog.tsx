import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Texts from the science review (docs/research/plan-review, "Material" sections 2, 3 and 5), lightly trimmed.
const GLOSSARY: [string, string][] = [
  [
    "NDVI (greenness index)",
    "A number from about 0.1 (bare soil) to 0.9 (dense green crop), worked out from red and near-infrared light. More green leaf, higher number.",
  ],
  [
    "NDMI (canopy moisture index)",
    "A similar number that drops when leaves hold less water or the canopy is thin. It supports a dry-season reading; it does not measure soil water.",
  ],
  ["Peak greenness", "The highest NDVI the field reached between 1 June and 20 August. The app compares it with the field's own usual peak."],
  [
    "Baseline (the field's usual)",
    "The middle value of this same field in its other cropped years since 2018. Fallow years are left out.",
  ],
  [
    "Fallow",
    "A year with no crop, the soil kept bare or under stubble to store water and control weeds. From space it looks like a failed crop, so the app asks you.",
  ],
  [
    "Cloud-free share",
    "The part of the field a satellite saw clearly on a given day. Images with less than three quarters of the field clear are not used.",
  ],
  ["Dekad", "A ten-day block. The season from 1 May to 30 September is cut into 15 of them so years can be compared."],
  [
    "Grid cell (regional weather)",
    "The roughly 50 km square for which NASA POWER gives one weather value. Every field inside it gets the same rain and temperature.",
  ],
  [
    "Hydrothermal coefficient (HTC, Selyaninov)",
    "Rain divided by one tenth of the summed daily temperatures on warm days. Around 1 means enough moisture; below 0.6 is dry. Used by Kazhydromet.",
  ],
  [
    "Carry-over",
    "What one season leaves for the next, either less soil water after a thirsty crop or herbicide residue that can injure the following crop. Satellites cannot see either.",
  ],
]

type Props = {
  /** Year of the satellite mosaic on the map, for its credit line. */
  year: number
  /** ISO date the open field's analysis was built, for the NASA POWER credit. */
  obtained?: string
}

export function AboutDialog({ year, obtained }: Props) {
  const mosaicYear = Math.min(2025, Math.max(2017, year))
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <InfoIcon data-icon="inline-start" />
          About the data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>About the data</DialogTitle>
          <DialogDescription>How sure the results are, what satellites can and cannot tell you, what the terms mean, and where the numbers come from.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 text-sm">
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">How sure is this?</h3>
            <p className="text-pretty text-muted-foreground">
              Field greenness comes from Sentinel-2 images. Cloud can hide a field for weeks, so a season rests on roughly 12 to 30 usable images
              and its peak can be missed. Finding levels compare this field with its own other cropped seasons (at most eight); the thresholds are
              indicative and have not been checked against yields or ground data. Weather comes from NASA POWER, a modelled grid of about 50 km:
              every field in a cell gets the same numbers, and a local storm, hail or a frost pocket is invisible. Crop stage dates are estimates,
              plus or minus 10 days. Rotation scores rest on a draft crop catalogue in which many values are the authors' judgement and no local
              agronomist has reviewed it; prices are dated. Treat every result as a reason to go and look, not as a conclusion.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">Satellite data versus ground measurements</h3>
            <p className="text-pretty text-muted-foreground">
              A satellite measures reflected light, not the crop. NDVI tells how much green leaf covers the ground. It does not measure yield,
              grain quality, soil moisture, nutrients or disease, and it cannot tell crop from weeds: a weedy field can look as green as a good
              crop, and a failed crop can look like fallow. A Sentinel-2 pixel is 10 to 20 m; the field value is the middle value of the cloud-free
              pixels on that day. A MODIS pixel is 250 m and mixes your field with its neighbours. Rain, temperature and soil wetness in this app
              are model estimates for an area about 50 km wide (9 km for the soil-moisture map layer), not readings from your field. A rain gauge,
              a soil probe or a walk through the crop is more accurate for your field and should overrule the app when they disagree. What
              satellites add is the same measurement on every field, every few days, back to 2018.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">Glossary</h3>
            <dl className="flex flex-col gap-2">
              {GLOSSARY.map(([term, meaning]) => (
                <div key={term}>
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-pretty text-muted-foreground">{meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">Data credits</h3>
            <ul className="flex flex-col gap-2 text-xs text-pretty text-muted-foreground">
              <li>
                The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide
                Energy Resources (POWER) project funded through the NASA Earth Science Division. The data was obtained from the POWER Project's
                Daily 2.10.3 version on {obtained ? obtained.slice(0, 10).replaceAll("-", "/") : "the day each field was analysed"}.
              </li>
              <li>
                We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth
                Science Data and Information System (ESDIS).
              </li>
              <li>Contains modified Copernicus Sentinel data 2018-2026</li>
              <li>
                EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data {mosaicYear})
              </li>
              <li>Base map: OpenFreeMap © OpenMapTiles, data from OpenStreetMap.</li>
              <li>Sentinel-2 and MODIS field statistics accessed through Microsoft Planetary Computer.</li>
              <li>Modelled soil properties, where shown: ISRIC SoilGrids 2.0, 250 m.</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
