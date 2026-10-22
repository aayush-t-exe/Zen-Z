import QRCode from 'qrcode';
import { links } from '@/lib/site';

/**
 * A QR code rendered to SVG on the server at build time. No client code and no
 * third-party QR service. Points at /get-app, which sends each phone to the
 * right place (Play Store, or the iPhone install steps).
 */
export default async function Qr({
  value = links.getAppAbsolute,
  className = '',
  dark = '#0A0908',
  light = '#FFFFFF',
  label = 'QR code for zen-z.site/get-app',
}: {
  value?: string;
  className?: string;
  dark?: string;
  light?: string;
  label?: string;
}) {
  const svg = await QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark, light },
  });
  return (
    <span
      role="img"
      aria-label={label}
      className={`block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
