import { Title } from '@solidjs/meta';
import { CodeBlock } from '../components/CodeBlock';
import { H2 } from '../components/Heading';

export default function FlowOverview() {
  return (
    <article class="docs-page">
      <Title>flow · slopkit</Title>
      <p class="docs-eyebrow">flow</p>
      <h1>Overview</h1>
      <p class="docs-lead">
        <code>@solid-slopkit/flow</code>: TODO, what the package does.
      </p>

      <H2 id="installation">Installation</H2>
      <p>
        Install <code>@solid-slopkit/flow</code> from npm.
      </p>
      <CodeBlock lang="bash" code="pnpm add @solid-slopkit/flow" />
      <p>
        It needs <code>solid-js</code> and <code>@solidjs/web</code> 2.x, which it takes as peer dependencies.
      </p>

      <H2 id="for-agents">For coding agents</H2>
      <p>
        The package ships its own docs for agents: task guides at <code>node_modules/@solid-slopkit/flow/skills/</code> and a
        reference per area, indexed in <code>node_modules/@solid-slopkit/flow/dist/source/llms.md</code>.
      </p>
    </article>
  );
}
