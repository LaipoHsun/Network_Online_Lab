// KaTeX 建置時預先繪製（docs/design.md 技術選型）：只在 .astro 檔裡呼叫，不會送到瀏覽器。
import katex from 'katex';

const OPTS = {
  throwOnError: true,
  strict: 'ignore' as const,
  output: 'html' as const,
  // 只允許 \htmlData，用來標記公式裡可以高亮的符號（data-key）
  trust: (ctx: { command: string }) => ctx.command === '\\htmlData',
};

/** 一段 TeX → HTML。 */
export function tex(src: string, display = false): string {
  return katex.renderToString(src, { ...OPTS, displayMode: display });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 一般文字裡夾著 $…$（行內）或 $$…$$（獨立一行）的公式 → HTML。
 * 其他文字會被跳脫；空白行分段落。
 */
export function texText(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => {
      const html = para.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g).map((part) => {
        if (part.startsWith('$$')) return tex(part.slice(2, -2), true);
        if (part.startsWith('$') && part.length > 1) return tex(part.slice(1, -1));
        return escapeHtml(part);
      }).join('');
      return `<p>${html}</p>`;
    })
    .join('');
}
