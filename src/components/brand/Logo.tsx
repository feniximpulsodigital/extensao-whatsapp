import iconUrl from "@/assets/brand/icon.svg";

type Props = {
  size?: number;
  showText?: boolean;
  className?: string;
};

export function Logo({ size = 32, showText = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={iconUrl} alt="Argos Zap" width={size} height={size} className="shrink-0" />
      {showText && (
        <span className="font-bold tracking-tight leading-none">
          <span className="text-foreground">Argos</span>
          <span className="text-accent">Zap</span>
        </span>
      )}
    </span>
  );
}
