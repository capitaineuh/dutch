import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Dutch — Le moins de points. Le plus de cran.', description: 'Votre prochaine soirée commence par quatre cartes. Jouez à Dutch entre amis, de 2 à 8 joueurs.', applicationName: 'Dutch', appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Dutch' }, icons: { icon: '/icon.svg', apple: '/icon-180.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#121212' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="fr"><body>{children}</body></html>; }
