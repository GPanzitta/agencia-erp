/**
 * SEG-ERP-07: el ÚNICO script de las ventanas de documentos (papeles A4,
 * etiquetas y la hoja de fotos).
 *
 * La ventana se abre con `window.open('')` + `document.write`: es about:blank,
 * hereda el origen del ERP y también su Content-Security-Policy. Con la CSP
 * de `vercel.json` no corren `onclick="…"` ni un `<script>` cualquiera; corre
 * éste porque su hash está en `script-src`. Por eso:
 *
 * - Los botones llevan `data-accion` y este script los atiende por
 *   delegación (imprimir, cerrar, imprimir-fotos, no-fotos).
 * - Las fotos (opcionales) se buscan al momento de usarlas: el script va
 *   igual en todos los documentos y la hoja de fotos se agrega después.
 *
 * NO SE TOCA SIN ACTUALIZAR EL HASH: si cambia un solo carácter, cambia
 * `HASH_SCRIPT_DOCUMENTO` y hay que copiarlo al `script-src` de `vercel.json`.
 * El spec `script-documento.spec.ts` falla si alguno de los tres no coincide.
 */
export const SCRIPT_DOCUMENTO = `
(function () {
  var d = document;
  function dialogo() { return d.getElementById('pf-dialogo'); }
  window.cerrarPreguntaDeFotos = function () { var x = dialogo(); if (x) x.hidden = true; };
  window.imprimirFotos = function () {
    window.cerrarPreguntaDeFotos();
    d.body.classList.add('solo-fotos');
    var imagenes = Array.prototype.slice.call(d.querySelectorAll('#hoja-fotos img'));
    Promise.all(imagenes.map(function (i) {
      return i.complete ? null : new Promise(function (listo) { i.onload = i.onerror = listo; });
    })).then(function () { window.print(); });
  };
  window.addEventListener('afterprint', function () {
    var x = dialogo();
    if (!x) return;
    // Volvió de imprimir las fotos: el papel vuelve a verse y no se pregunta de nuevo.
    if (d.body.classList.contains('solo-fotos')) {
      d.body.classList.remove('solo-fotos');
      return;
    }
    x.hidden = false;
    x.querySelector('button').focus();
  });
  d.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-accion]') : null;
    if (!b) return;
    var a = b.getAttribute('data-accion');
    if (a === 'imprimir') window.print();
    else if (a === 'cerrar') window.close();
    else if (a === 'imprimir-fotos') window.imprimirFotos();
    else if (a === 'no-fotos') window.cerrarPreguntaDeFotos();
  });
})();
`;

/** El hash CSP de `SCRIPT_DOCUMENTO` (el mismo que va en `vercel.json`). */
export const HASH_SCRIPT_DOCUMENTO = "'sha256-fFsUKj/czN3B627z3raUPagBItV8rqGtVcXHmIVvB+o='";

/** La etiqueta lista para pegar antes de `</body>`. */
export function scriptDocumento(): string {
  return `<script>${SCRIPT_DOCUMENTO}</script>`;
}
