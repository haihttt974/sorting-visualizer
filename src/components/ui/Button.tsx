export function Button({ children, onClick, disabled, className = "", type = "button" }: any) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
