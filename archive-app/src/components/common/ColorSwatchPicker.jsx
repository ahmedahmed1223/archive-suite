import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Palette } from "lucide-react";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * Color selector: preset swatches (as an accessible radiogroup) plus a custom
 * color control backed by a native <input type="color">. The custom control is
 * kept OUTSIDE the radiogroup so axe's aria-required-children rule stays happy
 * (a radiogroup may only contain radios). When the active value is not one of
 * the presets, the custom swatch shows it as selected (solid + ring); otherwise
 * it renders a dashed palette affordance.
 *
 * @param {string}   value     current color (hex)
 * @param {Function} onChange  (hex) => void
 * @param {string[]} presets   preset hex colors
 * @param {string}   labelId   id of the visible group label (for aria-labelledby)
 */
export function ColorSwatchPicker({ value, onChange, presets = [], labelId, className = "" }) {
  const isPreset = presets.includes(value);
  const customValue = HEX6.test(value) ? value : "#10b981";

  return jsxs("div", {
    className: `flex flex-wrap items-center gap-2 ${className}`,
    children: [
      jsx("div", {
        role: "radiogroup",
        "aria-labelledby": labelId,
        className: "flex flex-wrap gap-2",
        children: presets.map((item) => jsx("button", {
          type: "button",
          role: "radio",
          "aria-checked": value === item,
          onClick: () => onChange(item),
          className: `h-8 w-8 rounded-full border transition-transform ${value === item ? "scale-110 border-white ring-2 ring-white/25" : "border-white/10 hover:scale-105"}`,
          style: { backgroundColor: item },
          "aria-label": `اختيار لون ${item}`
        }, item))
      }),
      jsxs("label", {
        className: `relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${!isPreset ? "scale-110 border-white ring-2 ring-white/25" : "border-dashed border-white/30 text-gray-300"}`,
        style: !isPreset ? { backgroundColor: value } : undefined,
        title: "لون مخصص",
        children: [
          jsx("input", {
            type: "color",
            value: customValue,
            onChange: (event) => onChange(event.target.value),
            "aria-label": "اختيار لون مخصص",
            className: "absolute inset-0 h-full w-full cursor-pointer opacity-0"
          }),
          !isPreset ? null : jsx(Palette, { className: "h-4 w-4", "aria-hidden": true })
        ]
      })
    ]
  });
}

export default ColorSwatchPicker;
