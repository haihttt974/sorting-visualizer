export function Slider({ value, min, max, step, onChange, disabled }: any) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(+e.target.value)}
      className="w-full disabled:opacity-40"
    />
  );
}
