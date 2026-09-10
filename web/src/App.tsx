import { useState } from "react";
import { rgbToLab, labToRgb, labToCmyk, cmykToLab } from "rust-core";

type ColorControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  labelClass: string;
  min: number;
  max: number;
  step?: number;
};

type RgbResult = {
  r: number;
  g: number;
  b: number;
  clamped: boolean;
};

type LabResult = {
  l: number;
  a: number;
  b: number;
};

type CmykResult = {
  c: number;
  m: number;
  y: number;
  k: number;
  clamped?: boolean;
};

function ColorControl({
  label,
  value,
  onChange,
  labelClass,
  min,
  max,
  step = 1,
}: ColorControlProps) {
  const handleChange = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) return;

    const safeValue = Math.min(max, Math.max(min, nextValue));
    onChange(safeValue);
  };

  return (
    <label className="rgbControl">
      <span className={labelClass}>{label}</span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => handleChange(Number(event.target.value))}
      />

      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => handleChange(Number(event.target.value))}
      />
    </label>
  );
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const round = (value: number) => {
  return Math.round(value * 10) / 10;
};

const roundRgb = (value: number) => {
  return Math.round(clamp(value, 0, 255));
};

const rgbToHex = (red: number, green: number, blue: number) => {
  return `#${[red, green, blue]
    .map((channel) => roundRgb(channel).toString(16).padStart(2, "0"))
    .join("")}`;
};

function App() {
  const [red, setRed] = useState(151);
  const [green, setGreen] = useState(10);
  const [blue, setBlue] = useState(52);

  const [light, setLightness] = useState(0);
  const [aLab, setAlab] = useState(0);
  const [bLab, setBlab] = useState(0);

  const [cyan, setCyan] = useState(0);
  const [magenta, setMagenta] = useState(0);
  const [yellow, setYellow] = useState(0);
  const [k, setK] = useState(0);

  const color = `rgb(${red}, ${green}, ${blue})`;

  const applyRgb = (nextRed: number, nextGreen: number, nextBlue: number) => {
    const safeRed = roundRgb(nextRed);
    const safeGreen = roundRgb(nextGreen);
    const safeBlue = roundRgb(nextBlue);

    const nextLab = rgbToLab(safeRed, safeGreen, safeBlue) as LabResult;

    const nextCmyk = labToCmyk(
      nextLab.l,
      nextLab.a,
      nextLab.b
    ) as CmykResult;

    setRed(safeRed);
    setGreen(safeGreen);
    setBlue(safeBlue);

    setLightness(round(clamp(nextLab.l, 0, 100)));
    setAlab(round(clamp(nextLab.a, -128, 127)));
    setBlab(round(clamp(nextLab.b, -128, 127)));

    setCyan(round(clamp(nextCmyk.c, 0, 100)));
    setMagenta(round(clamp(nextCmyk.m, 0, 100)));
    setYellow(round(clamp(nextCmyk.y, 0, 100)));
    setK(round(clamp(nextCmyk.k, 0, 100)));
  };

  const applyLab = (nextLight: number, nextA: number, nextB: number) => {
    const safeLight = round(clamp(nextLight, 0, 100));
    const safeA = round(clamp(nextA, -128, 127));
    const safeB = round(clamp(nextB, -128, 127));

    const nextRgb = labToRgb(safeLight, safeA, safeB) as RgbResult;

    const nextCmyk = labToCmyk(
      safeLight,
      safeA,
      safeB
    ) as CmykResult;

    setLightness(safeLight);
    setAlab(safeA);
    setBlab(safeB);

    setRed(roundRgb(nextRgb.r));
    setGreen(roundRgb(nextRgb.g));
    setBlue(roundRgb(nextRgb.b));

    setCyan(round(clamp(nextCmyk.c, 0, 100)));
    setMagenta(round(clamp(nextCmyk.m, 0, 100)));
    setYellow(round(clamp(nextCmyk.y, 0, 100)));
    setK(round(clamp(nextCmyk.k, 0, 100)));
  };

  const applyCmyk = (
    nextCyan: number,
    nextMagenta: number,
    nextYellow: number,
    nextK: number
  ) => {
    const safeCyan = round(clamp(nextCyan, 0, 100));
    const safeMagenta = round(clamp(nextMagenta, 0, 100));
    const safeYellow = round(clamp(nextYellow, 0, 100));
    const safeK = round(clamp(nextK, 0, 100));

    const nextLab = cmykToLab(
      safeCyan,
      safeMagenta,
      safeYellow,
      safeK
    ) as LabResult;

    const nextRgb = labToRgb(
      nextLab.l,
      nextLab.a,
      nextLab.b
    ) as RgbResult;

    setCyan(safeCyan);
    setMagenta(safeMagenta);
    setYellow(safeYellow);
    setK(safeK);

    setLightness(round(clamp(nextLab.l, 0, 100)));
    setAlab(round(clamp(nextLab.a, -128, 127)));
    setBlab(round(clamp(nextLab.b, -128, 127)));

    setRed(roundRgb(nextRgb.r));
    setGreen(roundRgb(nextRgb.g));
    setBlue(roundRgb(nextRgb.b));
  };

  const handleColorPickerChange = (hex: string) => {
    const nextRed = parseInt(hex.slice(1, 3), 16);
    const nextGreen = parseInt(hex.slice(3, 5), 16);
    const nextBlue = parseInt(hex.slice(5, 7), 16);

    applyRgb(nextRed, nextGreen, nextBlue);
  };

  return (
    <main>
      <h1>Color lab</h1>
      <p>RGB · Lab · CMYK</p>

      <section className="workspace">
        <section className="previewCard">
          <div
            className="color-preview"
            style={{ backgroundColor: color }}
          />

          <p className="colorValue">
            rgb({red}, {green}, {blue})
          </p>


        </section>

        <section className="rgbPanel">
          <input
            className="colorPicker"
            type="color"
            value={rgbToHex(red, green, blue)}
            onChange={(event) => handleColorPickerChange(event.target.value)}
            aria-label="Choose an RGB color"
          />

          <h2>RGB</h2>

          <ColorControl
            label="Red"
            value={red}
            onChange={(nextRed) => applyRgb(nextRed, green, blue)}
            labelClass="redLabel"
            min={0}
            max={255}
          />

          <ColorControl
            label="Green"
            value={green}
            onChange={(nextGreen) => applyRgb(red, nextGreen, blue)}
            labelClass="greenLabel"
            min={0}
            max={255}
          />

          <ColorControl
            label="Blue"
            value={blue}
            onChange={(nextBlue) => applyRgb(red, green, nextBlue)}
            labelClass="blueLabel"
            min={0}
            max={255}
          />
        </section>

        <section className="LabPanel">
          <h2>LAB</h2>

          <ColorControl
            label="Lightness"
            value={light}
            onChange={(nextLight) => applyLab(nextLight, aLab, bLab)}
            labelClass="LabLabel"
            min={0}
            max={100}
            step={0.1}
          />

          <ColorControl
            label="A"
            value={aLab}
            onChange={(nextA) => applyLab(light, nextA, bLab)}
            labelClass="AlabLabel"
            min={-128}
            max={127}
            step={0.1}
          />

          <ColorControl
            label="B"
            value={bLab}
            onChange={(nextB) => applyLab(light, aLab, nextB)}
            labelClass="BlabLabel"
            min={-128}
            max={127}
            step={0.1}
          />
        </section>

        <section className="CMYKpanel">
          <h2>CMYK</h2>

          <ColorControl
            label="Cyan"
            value={cyan}
            onChange={(nextCyan) =>
              applyCmyk(nextCyan, magenta, yellow, k)
            }
            labelClass="CyanLabel"
            min={0}
            max={100}
            step={0.1}
          />

          <ColorControl
            label="Magenta"
            value={magenta}
            onChange={(nextMagenta) =>
              applyCmyk(cyan, nextMagenta, yellow, k)
            }
            labelClass="MagentaLabel"
            min={0}
            max={100}
            step={0.1}
          />

          <ColorControl
            label="Yellow"
            value={yellow}
            onChange={(nextYellow) =>
              applyCmyk(cyan, magenta, nextYellow, k)
            }
            labelClass="YellowLabel"
            min={0}
            max={100}
            step={0.1}
          />

          <ColorControl
            label="K"
            value={k}
            onChange={(nextK) =>
              applyCmyk(cyan, magenta, yellow, nextK)
            }
            labelClass="KLabel"
            min={0}
            max={100}
            step={0.1}
          />
        </section>
      </section>
    </main>
  );
}

export default App;