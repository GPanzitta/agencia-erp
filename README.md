# FG autos — ERP

El sistema que usa la agencia puertas adentro: stock, carga y publicación de autos,
interesados, ventas y reservas, comparación de precios, cajas, gastos y configuración.

Angular. Habla con `fg-autos-backend`.

## Para correrlo en tu máquina

1. `npm install`
2. `npm start -- --port 4400` (usa `src/environments/environment.development.ts`, que apunta al backend local en el puerto 3200).

## Antes de publicarlo

`src/environments/environment.ts`, `environment.staging.ts` y la política de seguridad de `vercel.json`
tienen direcciones de ejemplo que empiezan con `REEMPLAZAR-`: hay que poner las del backend y del sitio reales.

## Pruebas

`npm test -- --watch=false --browsers=ChromeHeadless`
