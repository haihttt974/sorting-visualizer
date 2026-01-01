export function Select({ value, onChange, children, disabled }: any) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-40"
    >
      {children}
    </select>
  );
}
