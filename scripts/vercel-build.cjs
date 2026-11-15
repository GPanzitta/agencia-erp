// Build de Vercel (spec 2026-10-28 §4 de taller-backend): sólo el deploy de
// producción se arma contra el backend de producción. Cualquier preview va
// contra staging, para que una rama de prueba nunca toque datos reales. Un
// build local, sin las variables de Vercel, sale con `production`.
const { execSync } = require('child_process');

function configuracionDeBuild(env) {
  if (env.VERCEL_GIT_COMMIT_REF === 'staging') return 'staging';
  return env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'staging' : 'production';
}

if (require.main === module) {
  const configuracion = configuracionDeBuild(process.env);
  console.log(`Build del ERP con la configuración ${configuracion}`);
  execSync(`npm run build -- --configuration ${configuracion}`, { stdio: 'inherit' });
}

module.exports = { configuracionDeBuild };
