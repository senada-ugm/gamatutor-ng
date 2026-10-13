import type { Metadata } from 'next';
// The player's own stylesheet, exactly as the standalone package ships it.
import '@gamatutor/course-player/src/styles.css';

export const metadata: Metadata = {
  title: { default: 'Belajar · DRIVE School', template: '%s · DRIVE School' },
};

/** A separate root layout: the player styles the whole page and must not inherit the site's. */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
