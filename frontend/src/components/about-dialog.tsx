import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const GLOSSARY: [string, string][] = [
  [
    "NDVI",
    "A greenness score from 0 to 1, worked out from how much red and near-infrared light the land reflects. Bare soil reads about 0.1 to 0.2; a dense, healthy crop 0.7 or more.",
  ],
  [
    "NDMI",
    "A moisture score for the leaves, from near-infrared and shortwave-infrared light. A low value when the crop is at its greenest suggests it was short of water.",
  ],
  ["Fallow", "A field left unsown for a season to store water and control weeds. From orbit it stays bare all summer."],
  [
    "Ten-day bin",
    "The season from 1 May to 30 September is cut into 15 ten-day steps. Each step holds the field average of the cloud-free satellite passes in those days.",
  ],
  [
    "Baseline (the field's normal)",
    "The middle curve of the field's own other cropped seasons. Each year is compared with the field itself, never with a neighbour.",
  ],
  [
    "Hydrothermal coefficient",
    "Selyaninov's drought index: May to August rain divided by one tenth of the summed daily temperatures of the days warmer than 10 °C. About 1 means rain kept pace with the heat; below 0.6 is a severe drought.",
  ],
  [
    "MODIS",
    "A NASA instrument on the Terra satellite that has imaged the whole Earth every day since 2000, at 250 m detail. Coarse, but the long record shows how unusual a season is. It reads a little greener than Sentinel-2, so each is compared only with itself.",
  ],
  [
    "Sentinel-2",
    "Two European Space Agency (ESA) satellites that pass over each field every few days at 10 m detail. Used here from 2018 for the within-field picture.",
  ],
  ["NASA POWER", "NASA's global daily weather record (rain, temperature, soil wetness), built from satellites and weather models and going back to 1981."],
  ["Grid cell", "One square of the weather record, about 55 x 42 km here. Every field inside it gets the same weather numbers."],
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
          <DialogDescription>What the terms mean, what satellites can and cannot tell you, and where the numbers come from.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 text-sm">
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
            <h3 className="font-medium">Satellite data and ground measurements</h3>
            <p className="text-pretty text-muted-foreground">
              A satellite measures light reflected from the surface, a few times a month when the sky is clear, averaged over squares of 10 to 250
              m. It sees how green and how moist the canopy is. It does not see which crop was sown, the yield, soil nutrients, salinity, pH, water
              stored at depth, weeds, pests or disease. The weather figures are modelled for a wide area, not read from a gauge in the field. A
              soil test, a rain gauge and a walk through the crop will always know things this tool cannot.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">How sure is this?</h3>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-pretty text-muted-foreground">
              <li>The thresholds behind every flag are indicative. They were tuned on a handful of fields and have not been tested on the ground.</li>
              <li>A fallow year and a failed crop can look alike from orbit. Land use is inferred, so correct it from what you know.</li>
              <li>Weather is regional: one figure for an area of about 55 x 42 km. A local storm or dry patch does not show.</li>
              <li>Rotation scores are relative and rest on published trials plus unreviewed judgement. They are not yield or price forecasts.</li>
              <li>The tool supports a decision. It does not make one: check any change with a local agronomist.</li>
            </ul>
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
