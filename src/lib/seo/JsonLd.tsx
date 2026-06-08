import { structuredData } from './structured-data';

/**
 * Renders the JSON-LD graphs into <head>. Server component — emitted in the
 * initial HTML so crawlers see it without running JS.
 */
export function JsonLd() {
  return (
    <>
      {structuredData().map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          // JSON.stringify output is safe to inline as structured data.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
    </>
  );
}
