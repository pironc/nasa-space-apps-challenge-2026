export const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

// GIBS REST tile order is {z}/{y}/{x}. Native max zoom is in the matrix-set name (Level9 = z9).
export const gibsUrl = (layer: string, date: string, level: number, ext: 'jpg' | 'png') =>
  `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

export const eoxUrl = (year: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`

// "+" must be percent-encoded or the API answers 400 "Unsupported band math expression".
export const pcNdviUrl = (item: string) =>
  'https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?' +
  new URLSearchParams({
    collection: 'sentinel-2-l2a',
    item,
    expression: '(B08-B04)/(B08+B04)',
    asset_as_band: 'true',
    rescale: '0,1',
    colormap_name: 'rdylgn',
  }).toString()

export const BASEMAPS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
