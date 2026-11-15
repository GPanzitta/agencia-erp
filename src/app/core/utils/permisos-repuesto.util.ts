/**
 * SEG-52 (decisión del dueño, 15/10/2026): archivar un repuesto (la baja) y
 * publicarlo o sacarlo de la tienda son de admin y mostrador. El superadmin
 * pasa como en todo el sistema. Pañol y técnico siguen editando el repuesto,
 * la categoría y la descripción de la tienda.
 *
 * Es UX: el backend corta igual (`DELETE /ingredientes/:id` y el campo
 * `publicado` de `PATCH /ingredientes/:id/publicacion` dan 403). Esto evita
 * ofrecer un botón que vuelve rebotado.
 */
export function puedeArchivarOPublicarRepuesto(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'mostrador' || rol === 'superadmin';
}
