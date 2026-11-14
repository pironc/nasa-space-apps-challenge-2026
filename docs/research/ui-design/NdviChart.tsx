import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// one y-axis, band = context in neutral ink, two categorical series (dataviz slots 1 and 2)
const config = {
  band: { label: "2017–2025 range", color: "var(--muted-foreground)" },
  y2024: { label: "2024", color: "var(--chart-1)" },
  y2021: { label: "2021 (drought)", color: "var(--chart-2)" },
} satisfies ChartConfig

type Row = { doy: string; band: [number, number]; y2024: number; y2021: number }

export function NdviChart({ data }: { data: Row[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <ComposedChart accessibilityLayer data={data} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="doy" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 1]} width={28} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area dataKey="band" stroke="none" fill="var(--color-band)" fillOpacity={0.15} isAnimationActive={false} />
        <Line dataKey="y2021" stroke="var(--color-y2021)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="y2024" stroke="var(--color-y2024)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceLine y={0.22} stroke="var(--border)" label={{ value: "bare soil 0.22", position: "insideBottomRight", fontSize: 11 }} />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  )
}
