interface AnomalyBadgeProps {
  count: number;
}

export default function AnomalyBadge({ count }: AnomalyBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}
