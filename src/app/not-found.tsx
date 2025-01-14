import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found - BTB Finance',
  description: 'The page you are looking for could not be found.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
        <p className="text-lg text-gray-400">The page you are looking for could not be found.</p>
        <a href="/" className="text-blue-500 hover:text-blue-400">
          Return Home
        </a>
      </div>
    </div>
  );
}
