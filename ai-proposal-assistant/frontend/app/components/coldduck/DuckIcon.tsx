import Image from "next/image";

interface Props {
  size?: number;
  className?: string;
}

export default function DuckIcon({ size = 24, className = "" }: Props) {
  return (
    <Image
      src="/coldducklogo.png"
      alt="ColdDuck"
      width={size}
      height={size}
      className={className}
    />
  );
}
