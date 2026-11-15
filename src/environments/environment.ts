// Este es el archivo que queda activo en el build de producción: en
// angular.json, la configuración "production" (default del build) NO tiene
// fileReplacements, así que usa este archivo tal cual; "development" sí lo
// reemplaza por environment.development.ts. Por eso el placeholder va acá
// y no en un environment.prod.ts (no existe en este proyecto).
//
// URLs del backend de la demo en Render (ver docs/deploy-demo.md del repo
// taller-backend). Si cambia el servicio, cambian acá.
export const environment = {
  production: true,
  apiUrl: 'https://REEMPLAZAR-backend-agencia.example/api',
  wsUrl: 'https://REEMPLAZAR-backend-agencia.example', // mismo host, sin /api (socket.io)
  // Marcador: reemplazar por el dominio real de Vercel una vez deployado el
  // portal (docs/deploy-demo.md de taller-backend no lo lista todavía).
  portalUrl: 'https://REEMPLAZAR-sitio-agencia.example',
  // DAT-05: horas sin tocar nada (en ninguna pestaña) hasta cerrar la sesión.
  // Un turno largo del mostrador; menos, si el dueño lo pide.
  inactividadHoras: 8,
};
