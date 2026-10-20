// The sidebar. Order here is the order shown; add a page by adding its route file under
// src/routes and an entry here.
export interface NavItem {
  title: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
  /** Shown after `items`, each under its own heading. */
  groups?: NavGroup[];
}

export const nav: NavSection[] = [
  {
    title: 'flow',
    items: [
      { title: 'Overview', href: '/' },
      { title: 'Flow and Viewport', href: '/flow' },
      { title: 'Nodes', href: '/nodes' },
      { title: 'Ports and Edges', href: '/edges' },
      { title: 'Connections', href: '/connections' },
      { title: 'Selection and editing', href: '/editing' },
      { title: 'Accessibility', href: '/accessibility' },
      { title: 'Built-in UI', href: '/built-in-ui' },
      { title: 'Layout', href: '/layout' },
      { title: 'Large Flows', href: '/large-flows' },
      { title: 'Server rendering', href: '/server-rendering' },
      { title: '3D dataflow', href: '/dataflow-3d' },
    ],
  },
];
