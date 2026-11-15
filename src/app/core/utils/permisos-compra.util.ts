/**
 * Quién puede registrar una compra que toca la caja.
 *
 * Compras es de los cuatro puestos de adentro: armar la OC, mandarla por
 * WhatsApp, editarla, cerrarla y cancelarla las hace cualquiera. Lo que NO es
 * de cualquiera son las dos operaciones que asientan un egreso de billetera:
 *
 *   - `POST /purchase-orders/directa`      (compra directa: OC + entrega + gasto)
 *   - `POST /purchase-orders/:id/entregas` (recepción: recibe y paga en el mismo request)
 *
 * Los dos son (ADMIN, PANOL) en el backend y siguen siéndolo: la decisión de
 * producto no cambió. Esto existe para que la pantalla diga lo mismo que el
 * backend en vez de ofrecer un Guardar que vuelve 403.
 *
 * Ojo con la recepción: no se puede "recibir sin pagar". El endpoint recibe la
 * mercadería y asienta el pago en la misma request, así que darle la pantalla
 * en solo-lectura al mostrador no le serviría para nada — lo que llegó ya lo
 * ve en el detalle de la OC, que sí es de los cuatro. El día que se parta en
 * dos endpoints, esta puerta se puede reabrir para la parte de mercadería.
 */
export function puedeRegistrarCompra(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'panol' || rol === 'superadmin';
}
