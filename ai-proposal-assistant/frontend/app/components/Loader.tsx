import Image from "next/image";

interface Props {
  size?: number;
  text?: string;
  className?: string;
}

export default function Loader({ size = 48, text, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <Image
        src="/loader.png"
        alt="Cargando"
        width={size}
        height={size}
        className="animate-spin"
      />
      {text && <p className="text-sm text-text-muted">{text}</p>}
    </div>
  );
}
