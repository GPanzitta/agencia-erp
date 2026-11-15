import { Observable } from 'rxjs';

/**
 * Abre un PDF que hay que pedir con la sesión (el token va en el header, así
 * que un `<a href>` no alcanza). La pestaña se abre YA, en el clic: si se
 * abriera cuando llega la respuesta, el navegador la bloquearía como popup.
 * Si el pedido falla, la pestaña vacía se cierra (el aviso lo da el interceptor).
 */
export function abrirPdfEnPestana(pedido: Observable<Blob>): void {
  const ventana = window.open('', '_blank');
  pedido.subscribe({
    next: (blob) => {
      // SEG-ERP-06: un blob: hereda el origen del ERP. Si la respuesta viniera
      // como text/html (un proxy, un error raro), la pestaña correría ese HTML
      // con acceso al token: se fuerza el tipo a PDF.
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (ventana) ventana.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    error: () => ventana?.close(),
  });
}
