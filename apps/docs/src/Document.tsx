import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';
import { themeScript } from './layout/preferences';
import { withBase } from './base';

// The document shell (the index.html replacement), picked up by the
// src/Document.* convention; it must render the full <html> and ships no
// client JS. <HydrationScript /> is stripped from the prerendered shell in
// client mode and activates under `ssr: true`. Delete this file to fall
// back to the plugin's built-in shell.
export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={withBase('/favicon.ico')} />
        <title>slopkit</title>
        {/* oxlint-disable-next-line solid/no-innerhtml -- a constant script of our own, no input in it */}
        <script innerHTML={themeScript} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
