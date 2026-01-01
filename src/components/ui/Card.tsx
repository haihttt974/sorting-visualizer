export function Card({ children, className = "" }: any) {
  return <div className={`rounded-xl border border-zinc-800 bg-zinc-900/60 ${className}`}>{children}</div>;
}
export const CardHeader = ({ children }: any) => <div className="mb-3">{children}</div>;
export const CardTitle = ({ children, className = "" }: any) => <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
export const CardContent = ({ children, className = "" }: any) => <div className={`space-y-4 ${className}`}>{children}</div>;
