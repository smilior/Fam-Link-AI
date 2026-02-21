type Size = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_MAP: Record<Size, string> = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-14 h-14 text-lg",
  "2xl": "w-20 h-20 text-2xl",
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-500",
  pink: "bg-mama-500",
  yellow: "bg-daughter-500",
  green: "bg-son-500",
};

export function MemberAvatar({
  displayName,
  color,
  size = "md",
}: {
  displayName: string;
  color: string;
  size?: Size;
}) {
  return (
    <div
      className={`${SIZE_MAP[size]} ${COLOR_MAP[color] || "bg-slate-500"} rounded-full flex items-center justify-center text-white font-bold`}
    >
      {displayName.charAt(0)}
    </div>
  );
}
