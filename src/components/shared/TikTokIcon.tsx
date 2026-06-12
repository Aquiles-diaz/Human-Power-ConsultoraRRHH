import type { SVGProps } from "react";

// Ícono de TikTok (lucide-react no incluye uno). Hereda color vía `currentColor`
// y tamaño vía clases de Tailwind (ej: className="size-5").
export function TikTokIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M16.5 3c.3 2.1 1.6 3.6 3.7 3.9v2.5c-1.3.1-2.5-.3-3.7-1v6.1c0 3.4-2.6 5.7-5.7 5.7C7.6 20.2 5 17.9 5 14.5s3-5.9 6.4-5.2v2.6c-.4-.1-.9-.2-1.3-.2-1.6 0-2.8 1.2-2.8 2.8s1.2 2.8 2.8 2.8 2.9-1.2 2.9-2.9V3h1.5z" />
    </svg>
  );
}

export default TikTokIcon;
