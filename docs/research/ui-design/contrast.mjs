// usage: node contrast.mjs <path-to-validate_palette.js>
const m = await import(process.argv[2]);
const pairs = [
  ["white on blue #2a78d6 (light primary)", "#ffffff", "#2a78d6"],
  ["white on blue #256abf (step 500)", "#ffffff", "#256abf"],
  ["#171717 on blue #3987e5 (dark primary)", "#171717", "#3987e5"],
  ["white on blue #3987e5 (dark primary)", "#ffffff", "#3987e5"],
  ["blue #2a78d6 on white", "#2a78d6", "#ffffff"],
  ["blue #3987e5 on #171717", "#3987e5", "#171717"],
  ["critical #d03b3b on white", "#d03b3b", "#ffffff"],
  ["warning #fab219 on white", "#fab219", "#ffffff"],
  ["good #0ca30c on white", "#0ca30c", "#ffffff"],
  ["blue #2a78d6 vs NDVI red #d73027", "#2a78d6", "#d73027"],
  ["blue #2a78d6 vs NDVI yellow #ffffbf", "#2a78d6", "#ffffbf"],
  ["blue #2a78d6 vs NDVI green #1a9850", "#2a78d6", "#1a9850"],
];
for (const [label, a, b] of pairs) {
  const c = m.contrast ? m.contrast(a, b) : NaN;
  const ap = m.apca ? m.apca(a, b) : NaN;
  console.log(label.padEnd(44), "WCAG", Number(c).toFixed(2), "APCA", Number(ap).toFixed(1));
}
