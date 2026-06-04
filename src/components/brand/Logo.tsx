import iconUrl from "@/assets/brand/icon.svg";
import { useTheme } from "@/components/theme-provider";

type Props = {
  size?: number;
  showText?: boolean;
  className?: string;
};

export function Logo({ size = 32, showText = true, className = "" }: Props) {
  const { branding } = useTheme();
  const src = branding?.brandLogoUrl || iconUrl;
  const name = branding?.brandName || "Argos Zap";
  const [first, ...rest] = name.split(" ");
  const second = rest.join(" ");

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ height: size, width: "auto", maxWidth: size * 2 }}
      />
      {showText && (
        <span className="font-bold tracking-tight leading-none">
          <span className="text-foreground">{first}</span>
          {second && <span className="text-accent">{second}</span>}
        </span>
      )}
    </span>
  );
}
