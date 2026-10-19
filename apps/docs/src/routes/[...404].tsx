import { Title } from '@solidjs/meta';
import type { RouteDefinition } from '@solidjs/router';
import { httpStatus } from '@solidjs/web';
import { withBase } from '../base';

// The catch-all route. httpStatus() is a no-op in the browser and takes
// effect when SSR is enabled; it runs in preload so the status code is set
// before the response head flushes.
export const route = {
  preload: () => httpStatus(404),
} satisfies RouteDefinition;

export default function NotFound() {
  return (
    <article class="docs-page">
      <Title>Not found · slopkit</Title>
      <h1>Page not found</h1>
      <p>
        This page doesn't exist. Go back to the <a href={withBase('/')}>overview</a>.
      </p>
    </article>
  );
}
