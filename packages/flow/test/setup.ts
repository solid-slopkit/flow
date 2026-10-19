// jest-dom matchers (toHaveAttribute, toHaveTextContent, …) and the
// @solidjs/diagnostics matchers (toHaveNoDiagnostics, toStayWithinRerunBudget, …).
import '@testing-library/jest-dom/vitest';
import '@solidjs/diagnostics/vitest';
// The stylesheets an app loads (ADR 0016): the components' first, then the Flow's.
import '@solid-slopkit/components/styles/slopkit.css';
import '@solid-slopkit/components/styles/default-theme.css';
import '../src/styles/flow.css';
