import { Loading } from 'solid-js';
import { Modals, Notifications, SlopkitUi } from '@solid-slopkit/components';
import { Router } from './router';
import { Shell } from './layout/Shell';
import '@solid-slopkit/components/styles/slopkit.css';
import '@solid-slopkit/components/styles/default-theme.css';
import './themes.css';

import './App.css';

export default function App() {
  return (
    <SlopkitUi>
      <Router>
        {(props) => (
          <Shell>
            <Loading fallback={<p class="docs-loading">Loading…</p>}>{props.children}</Loading>
          </Shell>
        )}
      </Router>
      <Notifications />
      <Modals />
    </SlopkitUi>
  );
}
