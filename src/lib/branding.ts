import type { CSSProperties } from "react";
function luminance(color: string) {
  const rgb = color
    .slice(1)
    .match(/../g)!
    .map((s) => parseInt(s, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function brandStyle(input: string): CSSProperties {
  const brand = /^#[0-9a-f]{6}$/i.test(input) ? input : "#242724";
  const lum = luminance(brand);
  const onBrand = (lum + 0.05) / 0.05 >= 4.5 ? "#000000" : "#ffffff";
  let accent = brand;
  const rgb = brand
    .slice(1)
    .match(/../g)!
    .map((s) => parseInt(s, 16));
  for (
    let step = 1;
    1.05 / (luminance(accent) + 0.05) < 4.5 && step <= 20;
    step++
  )
    accent =
      "#" +
      rgb
        .map((v) =>
          Math.round(v * (1 - step / 20))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  return {
    "--brand": brand,
    "--on-brand": onBrand,
    "--accent": accent,
  } as CSSProperties;
}
