export default function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-card border border-porcelain-border bg-white p-5 ${className}`}
      {...props}
    />
  );
}
