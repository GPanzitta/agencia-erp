// Build de la rama `staging` en Vercel (spec 2026-10-28 §4 de taller-backend):
// lo elige scripts/vercel-build.cjs. Igual que producción, pero contra el
// backend de staging. Si Render le asigna otro host, cambiar también el CSP
// de vercel.json y render.yaml (taller-backend).
export const environment = {
  production: true,
  apiUrl: 'https://REEMPLAZAR-backend-agencia-staging.example/api',
  wsUrl: 'https://REEMPLAZAR-backend-agencia-staging.example',
  // El dominio de rama del portal en Vercel (docs/operacion.md de taller-backend, paso 6).
  portalUrl: 'https://REEMPLAZAR-sitio-agencia-staging.example',
  inactividadHoras: 8,
};
