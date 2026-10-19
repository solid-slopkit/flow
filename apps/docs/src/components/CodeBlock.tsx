import { createMemo, createSignal, Loading, onCleanup } from 'solid-js';
import { Button } from '@solid-slopkit/components';
import { Check, Copy } from '@lucide/solid';
import { highlight, type CodeLang } from './highlight';

export function CodeBlock(props: { code: string; lang?: CodeLang }) {
  const code = () => props.code.trim();
  const html = createMemo(() => highlight(code(), props.lang ?? 'tsx'), { name: 'highlightedCode' });

  const [copied, setCopied] = createSignal(false, { name: 'copied' });
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(resetTimer));

  const copy = async () => {
    await navigator.clipboard.writeText(code());
    setCopied(true);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div class="docs-code">
      <Loading fallback={<pre class="docs-code-plain">{code()}</pre>}>
        {/* oxlint-disable-next-line solid/no-innerhtml -- the highlighter's output for our own example source, never user input */}
        <div class="docs-code-highlighted" innerHTML={html()} />
      </Loading>
      <Button
        class="docs-code-copy"
        variant="ghost"
        shape="square"
        size="xs"
        aria-label={copied() ? 'Copied' : 'Copy code'}
        onClick={copy}
      >
        {copied() ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
