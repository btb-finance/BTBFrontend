'use client';

import AppError from './error';

/** Last resort when the root layout itself throws: the same message, inside its own html and body. */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AppError {...props} />
      </body>
    </html>
  );
}
