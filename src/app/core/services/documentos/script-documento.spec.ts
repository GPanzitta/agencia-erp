import { HASH_SCRIPT_DOCUMENTO, SCRIPT_DOCUMENTO, scriptDocumento } from './script-documento';
import { documento } from './plantilla.util';
import vercel from '../../../../../vercel.json';

/** sha256 en base64, como lo calcula el navegador para `script-src`. */
async function hashCsp(texto: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return `'sha256-${btoa(String.fromCharCode(...bytes))}'`;
}

const cspDeVercel = (): string =>
  (vercel as any).headers.flatMap((h: any) => h.headers).find((h: any) => h.key === 'Content-Security-Policy')?.value ?? '';

const scriptsInline = (html: string): string[] => Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), (m) => m[1]);

describe('Script de los documentos y la CSP (SEG-ERP-07)', () => {
  it('el hash declarado es el del script', async () => {
    expect(await hashCsp(SCRIPT_DOCUMENTO)).toBe(HASH_SCRIPT_DOCUMENTO);
  });

  it('vercel.json lo permite en script-src y no abre unsafe-inline ni unsafe-eval para scripts', () => {
    const csp = cspDeVercel();
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? '';
    expect(scriptSrc).toContain(HASH_SCRIPT_DOCUMENTO);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('ningún documento lleva handlers inline y el único script es el permitido', () => {
    const papel = documento('Prueba', ['<section class="page">x</section>']);
    for (const html of [papel]) {
      expect(html).not.toMatch(/\son[a-z]+\s*=/i);
      expect(scriptsInline(html)).toEqual([SCRIPT_DOCUMENTO]);
    }
    expect(scriptDocumento()).toBe(`<script>${SCRIPT_DOCUMENTO}</script>`);
  });
});
