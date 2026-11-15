import { interpretarError } from './mensajes.util';

/** Arma lo que llega al interceptor: un HttpErrorResponse ya parseado. */
function respuesta(body: any, status = 400) {
  return { status, error: body, message: 'Http failure response' };
}

describe('interpretarError', () => {
  it('traduce CAJA_CERRADA mandando a la pantalla Cajas, donde se abre el turno', () => {
    const m = interpretarError(respuesta({ code: 'CAJA_CERRADA', message: 'x' }));
    expect(m.titulo).toBe('No hay una caja abierta');
    expect(m.detalle).toContain('Cajas');
    expect(m.accion).toEqual({ texto: 'Ir a Cajas', ruta: '/home/cajas' });
  });

  it('traduce CAJA_YA_ABIERTA sin ofrecer una ruta: no hay nada que abrir', () => {
    const m = interpretarError(respuesta({ code: 'CAJA_YA_ABIERTA', message: 'x' }, 409));
    expect(m.titulo).toBe('Ya hay una caja abierta');
    expect(m.detalle).toContain('administrador');
    expect(m.accion).toBeUndefined();
  });

  it('traduce SIN_RESPALDO_DE_COMPRA con una ruta que sí existe en el router', () => {
    const m = interpretarError(respuesta({ code: 'SIN_RESPALDO_DE_COMPRA', message: 'x' }));
    expect(m.accion).toEqual({ texto: 'Ir a compras', ruta: '/home/gastos/purchase-orders' });
  });

  it('traduce CUPO_COMPLETO sin ofrecer una ruta, porque se resuelve ahí mismo', () => {
    const m = interpretarError(respuesta({ code: 'CUPO_COMPLETO', message: 'x' }, 409));
    expect(m.titulo).toBe('Ese horario ya está completo');
    expect(m.accion).toBeUndefined();
  });

  /**
   * Los seis códigos que el backend manda con datos extra. Cada uno se prueba
   * dos veces: con el extra (el texto que de verdad sirve) y sin él (el texto
   * viejo, que tiene que seguir apareciendo y no un "undefined" en pantalla).
   */
  describe('detalles armados con los datos extra del backend', () => {
    it('SIN_RESPALDO_DE_COMPRA nombra cada repuesto y su motivo', () => {
      const m = interpretarError(
        respuesta({
          code: 'SIN_RESPALDO_DE_COMPRA',
          message: 'x',
          bloqueos: [
            { skuId: 's1', nombre: 'Bomba de agua', motivo: 'la compra OC-12 está impaga' },
            {
              skuId: 's2',
              nombre: 'Correa',
              motivo: 'no tiene una orden de compra asociada a esta reparación',
            },
          ],
        }),
      );
      expect(m.detalle).toContain('"Bomba de agua" la compra OC-12 está impaga');
      expect(m.detalle).toContain('"Correa" no tiene una orden de compra asociada');
      expect(m.detalle).toContain('Cargá la compra');
    });

    it('SIN_RESPALDO_DE_COMPRA sin bloqueos cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'SIN_RESPALDO_DE_COMPRA', message: 'x' }));
      expect(m.detalle).toContain('sin una orden de compra paga');
    });

    it('COBRO_SIN_BILLETERA dice cuánto falta cobrar, con formato de acá', () => {
      const m = interpretarError(
        respuesta({ code: 'COBRO_SIN_BILLETERA', message: 'x', saldo: 12345.6 }),
      );
      expect(m.detalle).toContain('12.345,60');
      expect(m.detalle).toContain('billetera');
    });

    it('COBRO_SIN_BILLETERA sin saldo cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'COBRO_SIN_BILLETERA', message: 'x' }));
      expect(m.detalle).toBe('Marcá en qué billetera se cobra antes de entregar el equipo.');
    });

    it('COBRO_NO_COINCIDE dice cuánto cobra la entrega y cuánto es de visitas, con formato de acá', () => {
      const m = interpretarError(
        respuesta({
          code: 'COBRO_NO_COINCIDE',
          message: 'x',
          a_cobrar: 45000.5,
          declarado: 40000,
          costo_visitas: 10000,
        }),
      );
      expect(m.titulo).toBe('Cambió lo que hay que cobrar');
      expect(m.detalle).toContain('Esta entrega cobra $45.000,50');
      expect(m.detalle).toContain('$10.000,00 de visitas');
      expect(m.detalle).toContain('no dejes el equipo: marcá "No se pudo"');
      expect(m.accion).toBeUndefined();
    });

    it('COBRO_NO_COINCIDE sin visitas no las nombra', () => {
      const m = interpretarError(
        respuesta({ code: 'COBRO_NO_COINCIDE', message: 'x', a_cobrar: 30000, declarado: 0, costo_visitas: 0 }),
      );
      expect(m.detalle).toContain('Esta entrega cobra $30.000,00.');
      expect(m.detalle).not.toContain('visitas');
    });

    it('COBRO_NO_COINCIDE con nada que cobrar pide no cobrarle al cliente', () => {
      const m = interpretarError(
        respuesta({ code: 'COBRO_NO_COINCIDE', message: 'x', a_cobrar: 0, declarado: 5000, costo_visitas: 0 }),
      );
      expect(m.detalle).toBe('Esta entrega no tiene nada que cobrar: no le cobres al cliente.');
    });

    it('COBRO_NO_COINCIDE sin el monto cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'COBRO_NO_COINCIDE', message: 'x' }));
      expect(m.detalle).toBe(
        'Lo cobrado no es lo que se asienta. Cobrá el monto que figura ahora en la parada; ' +
          'si el cliente no paga eso, no dejes el equipo: marcá "No se pudo".',
      );
    });

    // ─── D2 (tanda 3b): cada medio de cobro de la puerta a su billetera ────
    it('RUTA_SIN_BILLETERA habla de la caja para efectivo y ofrece los otros medios', () => {
      const m = interpretarError(respuesta({ code: 'RUTA_SIN_BILLETERA', message: 'x' }));
      expect(m.titulo).toBe('La ruta no tiene caja para efectivo');
      expect(m.detalle).toBe(
        'Cobrá por transferencia o Mercado Pago, o pedile al mostrador que le asigne una caja a la ruta.',
      );
      expect(m.accion).toBeUndefined();
    });

    it('MEDIO_SIN_BILLETERA con la billetera desactivada la nombra', () => {
      const m = interpretarError(
        respuesta({
          code: 'MEDIO_SIN_BILLETERA',
          message: 'x',
          medio: 'mercado_pago',
          motivo: 'inactiva',
          billetera: 'Mercado Pago',
        }),
      );
      expect(m.titulo).toBe('No se puede cobrar por ese medio');
      expect(m.detalle).toBe(
        'La billetera «Mercado Pago» está desactivada. Cobrá por otro medio o avisale al mostrador ' +
          'antes de dejar el equipo.',
      );
      expect(m.accion).toBeUndefined();
    });

    it('MEDIO_SIN_BILLETERA desactivada pero sin el nombre no dice "undefined"', () => {
      const m = interpretarError(
        respuesta({ code: 'MEDIO_SIN_BILLETERA', message: 'x', medio: 'efectivo', motivo: 'inactiva' }),
      );
      expect(m.detalle).toContain('La billetera de ese medio está desactivada.');
      expect(m.detalle).not.toContain('undefined');
    });

    it('MEDIO_SIN_BILLETERA sin configurar dice qué medio falta y dónde se carga', () => {
      const transferencia = interpretarError(
        respuesta({ code: 'MEDIO_SIN_BILLETERA', message: 'x', medio: 'transferencia', motivo: 'sin_configurar' }),
      );
      expect(transferencia.detalle).toBe(
        'El taller todavía no configuró dónde entran los cobros por transferencia. Cobrá por otro ' +
          'medio o pedile al administrador que lo cargue en Configuración › Empresa.',
      );

      const mp = interpretarError(
        respuesta({ code: 'MEDIO_SIN_BILLETERA', message: 'x', medio: 'mercado_pago', motivo: 'sin_configurar' }),
      );
      expect(mp.detalle).toContain('los cobros por Mercado Pago.');
    });

    it('MEDIO_SIN_BILLETERA sin datos cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'MEDIO_SIN_BILLETERA', message: 'x' }));
      expect(m.detalle).toContain('los cobros por ese medio.');
    });

    it('RUTA_BILLETERA_RESERVADA con una ruta abierta dice cuál y de qué día', () => {
      const m = interpretarError(
        respuesta({
          code: 'RUTA_BILLETERA_RESERVADA',
          message: 'x',
          reservada_para: 'transferencia',
          billetera: 'Caja efectivo',
          ruta_abierta: { id: 'r1', fecha: '2026-09-26' },
        }),
      );
      expect(m.titulo).toBe('Esa billetera ya tiene otro uso');
      expect(m.detalle).toBe(
        '«Caja efectivo» es la caja de una ruta que todavía no se cerró (26/09/2026). Cerrala primero ' +
          'o elegí otra billetera.',
      );
      expect(m.accion).toBeUndefined();
    });

    it('RUTA_BILLETERA_RESERVADA al armar la ruta dice para qué está reservada', () => {
      const mp = interpretarError(
        respuesta({ code: 'RUTA_BILLETERA_RESERVADA', message: 'x', reservada_para: 'mercado_pago', billetera: 'Mercado Pago' }),
      );
      expect(mp.detalle).toBe(
        '«Mercado Pago» es la billetera de Mercado Pago: el efectivo del chofer va a una caja propia, de tipo efectivo.',
      );

      const transferencia = interpretarError(
        respuesta({ code: 'RUTA_BILLETERA_RESERVADA', message: 'x', reservada_para: 'transferencia', billetera: 'Banco' }),
      );
      expect(transferencia.detalle).toBe(
        '«Banco» es la billetera de las transferencias: el efectivo del chofer va a una caja propia, de tipo efectivo.',
      );
    });

    it('RUTA_BILLETERA_RESERVADA sin datos no adivina el medio ni dice "undefined"', () => {
      const m = interpretarError(respuesta({ code: 'RUTA_BILLETERA_RESERVADA', message: 'x' }));
      expect(m.detalle).toBe(
        'Esa billetera es una billetera de cobros (Mercado Pago o transferencias): el efectivo del ' +
          'chofer va a una caja propia, de tipo efectivo.',
      );
    });

    // #41 (tanda 4): la billetera de cobros no se da de baja. Cada una se
    // cambia en una pantalla distinta: la de MP en Tienda, la de
    // transferencias en Empresa.
    it('BILLETERA_EN_USO de Mercado Pago lleva a Tienda', () => {
      const m = interpretarError(
        respuesta({ code: 'BILLETERA_EN_USO', message: 'x', uso: 'mercado_pago', billetera: 'MP' }),
      );
      expect(m.titulo).toBe('Esa billetera recibe cobros');
      expect(m.detalle).toBe(
        '«MP» es donde entran los cobros de Mercado Pago. Elegí otra en Configuración › Tienda y ' +
          'después dala de baja.',
      );
      expect(m.accion).toEqual({ texto: 'Ir a Tienda', ruta: '/home/configuracion/tienda' });
    });

    it('BILLETERA_EN_USO de transferencias lleva a Empresa', () => {
      const m = interpretarError(
        respuesta({ code: 'BILLETERA_EN_USO', message: 'x', uso: 'transferencia', billetera: 'Banco' }),
      );
      expect(m.detalle).toBe(
        '«Banco» es donde entran las transferencias que cobra el chofer. Elegí otra en ' +
          'Configuración › Empresa y después dala de baja.',
      );
      expect(m.accion).toEqual({ texto: 'Ir a Empresa', ruta: '/home/configuracion/empresa' });
    });

    it('BILLETERA_EN_USO sin datos no dice "undefined" y lleva a Empresa, donde están las dos', () => {
      const m = interpretarError(respuesta({ code: 'BILLETERA_EN_USO', message: 'x' }));
      expect(m.detalle).toBe(
        'Esa billetera es donde entran los cobros de Mercado Pago o las transferencias. Elegí otra en ' +
          'Configuración › Empresa y después dala de baja.',
      );
      expect(m.accion).toEqual({ texto: 'Ir a Empresa', ruta: '/home/configuracion/empresa' });
    });

    it('CUPO_COMPLETO dice cuántos turnos hay tomados sobre el cupo', () => {
      const m = interpretarError(
        respuesta({ code: 'CUPO_COMPLETO', message: 'x', ocupados: 6, cupo: 6 }, 409),
      );
      expect(m.detalle).toContain('Ya hay 6 de 6 turnos');
      expect(m.detalle).toContain('forzar el turno');
    });

    it('CUPO_COMPLETO sin ocupados/cupo cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'CUPO_COMPLETO', message: 'x' }, 409));
      expect(m.detalle).toBe(
        'Elegí otro horario. Si es urgente, un encargado puede forzar el turno.',
      );
    });

    it('DIA_NO_LABORABLE nombra el día en dd/mm/aaaa, sin correrlo de huso horario', () => {
      const m = interpretarError(
        respuesta({ code: 'DIA_NO_LABORABLE', message: 'x', fecha: '2026-09-14' }),
      );
      expect(m.detalle).toContain('El 14/09/2026 el taller no atiende');
    });

    it('DIA_NO_LABORABLE sin fecha cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'DIA_NO_LABORABLE', message: 'x' }));
      expect(m.detalle).toBe('Elegí un día habilitado en la configuración de la agenda.');
    });

    it('PARADAS_SIN_MARCAR cuenta las paradas y concuerda el singular', () => {
      const varias = interpretarError(
        respuesta({ code: 'PARADAS_SIN_MARCAR', message: 'x', sin_marcar: 3 }),
      );
      expect(varias.detalle).toContain('Quedan 3 paradas sin marcar');

      const una = interpretarError(
        respuesta({ code: 'PARADAS_SIN_MARCAR', message: 'x', sin_marcar: 1 }),
      );
      expect(una.detalle).toContain('Queda 1 parada sin marcar');
    });

    it('PARADAS_SIN_MARCAR sin el conteo cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'PARADAS_SIN_MARCAR', message: 'x' }));
      expect(m.detalle).toBe(
        'Cerrá cada parada —entregada, retirada o fallida— antes de cerrar la ruta.',
      );
    });

    it('PRESUPUESTO_VENCIDO dice cuándo venció, aunque la fecha llegue en ISO con hora', () => {
      const m = interpretarError(
        respuesta({
          code: 'PRESUPUESTO_VENCIDO',
          message: 'x',
          vigente_hasta: '2026-08-01T00:00:00.000Z',
        }),
      );
      expect(m.detalle).toContain('Venció el 01/08/2026');
      expect(m.detalle).toContain('recotizar');
    });

    it('PRESUPUESTO_VENCIDO sin la fecha cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'PRESUPUESTO_VENCIDO', message: 'x' }));
      expect(m.detalle).toBe(
        'Pasó la fecha de validez. Hay que recotizar antes de que el cliente apruebe.',
      );
    });
  });

  describe('sesión y permisos', () => {
    it('SESION_VENCIDA no habla de permisos y no ofrece acción: el interceptor ya lleva al login', () => {
      const m = interpretarError(
        respuesta({ code: 'SESION_VENCIDA', message: 'Token revoked, please log in again' }, 401),
      );
      expect(m.titulo).toBe('Tu sesión venció');
      expect(m.detalle).toBe('Entrá de nuevo con tu usuario y contraseña para seguir trabajando.');
      expect(m.accion).toBeUndefined();
      // El inglés del backend ya no se reenvía.
      expect(m.detalle).not.toContain('Token');
    });

    it('USUARIO_DADO_DE_BAJA lo dice con todas las letras', () => {
      const m = interpretarError(respuesta({ code: 'USUARIO_DADO_DE_BAJA', message: 'x' }, 401));
      expect(m.titulo).toBe('Tu usuario está dado de baja');
      expect(m.detalle).toBe('Hablá con el encargado.');
    });

    // Códigos nuevos del backend (tanda 1 de arreglos).
    it('MOVIMIENTO_YA_REVERTIDO avisa que no se movió plata de nuevo', () => {
      const m = interpretarError(respuesta({ code: 'MOVIMIENTO_YA_REVERTIDO', message: 'x' }, 409));
      expect(m.titulo).toBe('Ese movimiento ya estaba revertido');
      expect(m.detalle).toContain('no se volvió a mover plata');
    });

    it('PARADA_YA_MARCADA y TURNO_NO_VIGENTE usan el porqué del backend', () => {
      const p = interpretarError(
        respuesta({ code: 'PARADA_YA_MARCADA', message: 'Esa parada ya tiene un cobro: no se puede sacar de la ruta.' }),
      );
      expect(p.titulo).toBe('Esa parada ya no se puede sacar');
      expect(p.detalle).toBe('Esa parada ya tiene un cobro: no se puede sacar de la ruta.');
      const t = interpretarError(respuesta({ code: 'TURNO_NO_VIGENTE', message: '' }));
      expect(t.titulo).toBe('Ese turno ya no está vigente');
      expect(t.detalle).toContain('Recargá la Agenda');
    });

    it('CREDENCIALES_INVALIDAS explica el login fallido sin decir cuál de los dos datos falló', () => {
      const m = interpretarError(
        respuesta(
          { code: 'CREDENCIALES_INVALIDAS', message: 'Usuario o contraseña incorrectos.' },
          401,
        ),
      );
      expect(m.titulo).toBe('Usuario o contraseña incorrectos');
      expect(m.detalle).toBe('Revisá los datos y probá de nuevo.');
      expect(m.accion).toBeUndefined();
    });

    it('SIN_PERMISO usa texto fijo y ya no reenvía el message del guard', () => {
      const m = interpretarError(
        respuesta({ code: 'SIN_PERMISO', message: 'User Ana needs a valid role [admin]' }, 403),
      );
      expect(m.titulo).toBe('Tu puesto no puede hacer esto');
      expect(m.detalle).toBe(
        'Esta acción la hace otro puesto. Si te corresponde, pedile al administrador que revise tu rol.',
      );
      expect(m.detalle).not.toContain('needs a valid role');
    });
  });

  describe('cuerpos que no son JSON', () => {
    it('el HTML de un 502 de proxy no llega crudo a la pantalla', () => {
      const m = interpretarError({
        status: 502,
        error: '<html><body><h1>502 Bad Gateway</h1></body></html>',
        message: 'Http failure response for /api/x: 502 Bad Gateway',
      });
      expect(m.titulo).toBe('Hubo un problema del sistema');
      expect(m.detalle).not.toContain('Http failure');
      expect(m.detalle).not.toContain('html');
    });

    it('un 500 con cuerpo JSON pero sin código tampoco reenvía el mensaje', () => {
      const m = interpretarError(respuesta({ message: 'relation "users" does not exist' }, 500));
      expect(m.titulo).toBe('Hubo un problema del sistema');
      expect(m.detalle).not.toContain('relation');
    });
  });

  it('usa los datos extra para armar el detalle de FONDOS_INSUFICIENTES', () => {
    const m = interpretarError(
      respuesta({
        code: 'FONDOS_INSUFICIENTES',
        message: 'x',
        billetera: 'Caja efectivo',
        disponible: 1500,
        solicitado: 3800,
      }),
    );
    expect(m.detalle).toContain('Caja efectivo');
    expect(m.detalle).toContain('1500');
    expect(m.detalle).toContain('3800');
  });

  it('para DATOS_INVALIDOS muestra el mensaje del backend, que ya viene traducido', () => {
    const m = interpretarError(
      respuesta({ code: 'DATOS_INVALIDOS', message: 'Nombre: es obligatorio.' }),
    );
    expect(m.titulo).toBe('Faltan datos o hay algo mal cargado');
    expect(m.detalle).toBe('Nombre: es obligatorio.');
  });

  it('ACCION_INVALIDA_PARA_ESTADO explica que la pantalla quedó vieja', () => {
    const m = interpretarError(
      respuesta({ code: 'ACCION_INVALIDA_PARA_ESTADO', message: 'x', estado: 'entregada' }),
    );
    expect(m.titulo).toBe('Esa acción ya no corresponde');
    expect(m.detalle).toContain('actualizá la pantalla');
  });

  it('para SOLICITUD_RECHAZADA muestra el mensaje que manda el backend', () => {
    const m = interpretarError(
      respuesta({ code: 'SOLICITUD_RECHAZADA', message: 'No podés anular un pago ya conciliado.' }),
    );
    expect(m.detalle).toBe('No podés anular un pago ya conciliado.');
  });

  it('para CONFLICTO muestra el mensaje que manda el backend', () => {
    const m = interpretarError(
      respuesta({ code: 'CONFLICTO', message: 'Ese número de comprobante ya existe.' }, 409),
    );
    expect(m.detalle).toBe('Ese número de comprobante ya existe.');
  });

  it('un código no mapeado cae en el default honesto y muestra el código', () => {
    const m = interpretarError(respuesta({ code: 'CODIGO_NUEVO', message: 'Algo pasó' }));
    expect(m.titulo).toBe('No se pudo completar');
    expect(m.detalle).toContain('CODIGO_NUEVO');
  });

  it('un error sin código usa el mensaje del backend', () => {
    const m = interpretarError(respuesta({ message: 'Orden inexistente' }, 404));
    expect(m.detalle).toContain('Orden inexistente');
  });

  it('un error de red no rompe y dice algo útil', () => {
    const m = interpretarError({ status: 0, error: null, message: 'Unknown Error' });
    expect(m.titulo).toBe('No hay conexión con el servidor');
  });

  it('no explota con null', () => {
    const m = interpretarError(null);
    expect(m.titulo).toBe('No se pudo completar');
  });

  it('traduce el intento de borrar o recontextualizar un mensaje del sistema', () => {
    const m = interpretarError(respuesta({ code: 'PLANTILLA_DEL_SISTEMA', message: 'x' }));
    expect(m.titulo).toContain('sistema');
    expect(m.detalle).toContain('desactiv');
  });

  /**
   * Pañol y compras (spec C §5.4). Los cuatro códigos que el backend C1 puede
   * devolver desde las pantallas de repuestos.
   */
  describe('pañol y compras', () => {
    it('STOCK_NO_EDITABLE manda al ajuste de la ficha y no ofrece ruta', () => {
      const m = interpretarError(respuesta({ code: 'STOCK_NO_EDITABLE', message: 'x' }));
      expect(m.titulo).toBe('El stock no se edita a mano');
      expect(m.detalle).toContain('Ajustar stock');
      expect(m.accion).toBeUndefined();
    });

    it('MOTIVO_REQUERIDO explica por qué hace falta el motivo', () => {
      const m = interpretarError(respuesta({ code: 'MOTIVO_REQUERIDO', message: 'x' }));
      expect(m.titulo).toBe('Falta el motivo');
      expect(m.detalle).toContain('kardex');
    });

    it('REPUESTO_EN_USO nombra el stock y las órdenes que lo esperan', () => {
      const m = interpretarError(
        respuesta({
          code: 'REPUESTO_EN_USO',
          message: 'x',
          stock: 4,
          ordenes: [
            { numero_orden: 'OR-2026-0001', cantidad: 2 },
            { numero_orden: 'OR-2026-0007', cantidad: 1 },
          ],
        }),
      );
      expect(m.detalle).toContain('tiene 4 en stock');
      expect(m.detalle).toContain('OR-2026-0001, OR-2026-0007');
      expect(m.detalle).not.toContain('no se puede deshacer');
    });

    it('REPUESTO_EN_USO sin datos extra cae al texto general', () => {
      const m = interpretarError(respuesta({ code: 'REPUESTO_EN_USO', message: 'x' }));
      expect(m.detalle).toContain('Ajustá el stock');
      expect(m.detalle).not.toContain('undefined');
    });

    it('REPUESTO_DUPLICADO nombra el repuesto que ya existe', () => {
      const m = interpretarError(
        respuesta({ code: 'REPUESTO_DUPLICADO', message: 'x', nombre: 'Capacitor 30µF' }),
      );
      expect(m.detalle).toContain('Capacitor 30µF');
      expect(m.accion).toBeUndefined();
    });

    it('REPUESTO_DUPLICADO sin nombre sigue diciendo qué hacer', () => {
      const m = interpretarError(respuesta({ code: 'REPUESTO_DUPLICADO', message: 'x' }));
      expect(m.detalle).toContain('nombre');
      expect(m.detalle).not.toContain('undefined');
    });
  });

  /**
   * Identificación y catálogo (spec C5 §5.4). Los cuatro salen del pañol y
   * dos de ellos viajan con 409: el interceptor traduce por `code`, no por
   * status, así que un 409 se traduce igual que un 400.
   */
  describe('identificación y catálogo', () => {
    it('CODIGO_EN_USO nombra al repuesto que lo tiene y ofrece abrirlo', () => {
      const m = interpretarError(
        respuesta(
          {
            code: 'CODIGO_EN_USO',
            message: 'x',
            codigo: 'CAP-30',
            repuesto_id: 'r1',
            repuesto_nombre: 'Capacitor 30 µF',
          },
          409,
        ),
      );
      expect(m.titulo).toBe('Ese código ya está usado');
      expect(m.detalle).toContain('CAP-30');
      expect(m.detalle).toContain('Capacitor 30 µF');
      expect(m.accion).toEqual({ texto: 'Ver ese repuesto', ruta: '/home/inventario/r1' });
    });

    it('CODIGO_EN_USO sin el id del dueño no ofrece un botón a ningún lado', () => {
      const m = interpretarError(respuesta({ code: 'CODIGO_EN_USO', message: 'x' }, 409));
      expect(m.accion).toBeUndefined();
      expect(m.detalle).not.toContain('undefined');
    });

    it('SINONIMO_EN_USO dice qué término choca', () => {
      const m = interpretarError(
        respuesta({ code: 'SINONIMO_EN_USO', message: 'x', termino: 'correa' }, 409),
      );
      expect(m.titulo).toBe('Ese término ya está en otro grupo');
      expect(m.detalle).toContain('correa');
    });

    it('SINONIMO_EN_USO sin término sigue diciendo qué hacer', () => {
      const m = interpretarError(respuesta({ code: 'SINONIMO_EN_USO', message: 'x' }, 409));
      expect(m.detalle).toContain('grupo');
      expect(m.detalle).not.toContain('undefined');
    });

    it('FUSION_INVALIDA usa el motivo concreto que manda el backend', () => {
      const m = interpretarError(
        respuesta({ code: 'FUSION_INVALIDA', message: 'Un repuesto no se fusiona consigo mismo.' }),
      );
      expect(m.titulo).toBe('No se pueden fusionar esos dos');
      expect(m.detalle).toContain('no se fusiona consigo mismo');
    });

    it('REPUESTO_FUSIONADO manda a la ficha del ganador', () => {
      const m = interpretarError(
        respuesta(
          {
            code: 'REPUESTO_FUSIONADO',
            message: 'x',
            ganador_id: 'g1',
            ganador_nombre: 'Capacitor 30 µF',
          },
          409,
        ),
      );
      expect(m.titulo).toBe('Ese repuesto se fusionó en otro');
      expect(m.detalle).toContain('Capacitor 30 µF');
      expect(m.accion).toEqual({ texto: 'Ir al repuesto que quedó', ruta: '/home/inventario/g1' });
    });

    it('REPUESTO_FUSIONADO sin ganador no inventa una ruta', () => {
      const m = interpretarError(respuesta({ code: 'REPUESTO_FUSIONADO', message: 'x' }, 409));
      expect(m.accion).toBeUndefined();
      expect(m.detalle).not.toContain('undefined');
    });
  });

  /**
   * C3 — los dos códigos que el ciclo de la orden agrega. Cada uno se prueba
   * dos veces: con los datos extra (el texto que de verdad sirve) y sin ellos
   * (que tiene que seguir diciendo qué hacer, y nunca "undefined").
   */
  describe('reserva y precio en el ciclo de la orden (C3)', () => {
    it('REPUESTO_YA_INGRESADO nombra los repuestos que frenan el rediagnóstico', () => {
      const m = interpretarError(
        respuesta({
          code: 'REPUESTO_YA_INGRESADO',
          message: 'x',
          repuestos: [
            { sku_id: 'r1', nombre: 'Plaqueta universal', motivo: 'ingresado' },
            { sku_id: 'r2', nombre: 'Capacitor 30 µF', motivo: 'consumido' },
          ],
        }),
      );
      expect(m.titulo).toBe('Ese repuesto ya está en el taller');
      expect(m.detalle).toContain('Plaqueta universal');
      expect(m.detalle).toContain('Capacitor 30 µF');
      expect(m.accion).toBeUndefined();
    });

    it('REPUESTO_YA_INGRESADO distingue el que llegó del que ya se usó', () => {
      const m = interpretarError(
        respuesta({
          code: 'REPUESTO_YA_INGRESADO',
          message: 'x',
          repuestos: [{ sku_id: 'r2', nombre: 'Motor', motivo: 'consumido' }],
        }),
      );
      expect(m.detalle).toContain('ya se usó');
    });

    it('REPUESTO_YA_INGRESADO sin la lista sigue diciendo qué hacer', () => {
      const m = interpretarError(respuesta({ code: 'REPUESTO_YA_INGRESADO', message: 'x' }));
      expect(m.detalle).toContain('pañol');
      expect(m.detalle).not.toContain('undefined');
    });

    it('STOCK_INSUFICIENTE dice cuánto hay y cuánto se pidió', () => {
      const m = interpretarError(
        respuesta({
          code: 'STOCK_INSUFICIENTE',
          message: 'x',
          sku_id: 's1',
          nombre: 'Capacitor 30 µF',
          stock: 1,
          cantidad: 3,
        }),
      );
      expect(m.titulo).toBe('No hay stock suficiente');
      expect(m.detalle).toContain('Capacitor 30 µF');
      expect(m.detalle).toContain('1');
      expect(m.detalle).toContain('3');
      expect(m.accion).toEqual({ texto: 'Ver ese repuesto', ruta: '/home/inventario/s1' });
    });

    it('STOCK_INSUFICIENTE sin el id del repuesto no ofrece un botón a ningún lado', () => {
      const m = interpretarError(respuesta({ code: 'STOCK_INSUFICIENTE', message: 'x' }));
      expect(m.accion).toBeUndefined();
      expect(m.detalle).not.toContain('undefined');
    });
  });

  /**
   * Tanda 2 de plata: el pago contra entrega sale de la factura, así que un
   * neto que no coincide con lo recibido se frena antes de mover plata.
   */
  describe('factura de la entrega (FACTURA_DIFIERE)', () => {
    it('dice cuánto dice la factura y cuánto suman los renglones, con formato de acá', () => {
      const m = interpretarError(
        respuesta({ code: 'FACTURA_DIFIERE', message: 'x', neto: 500, renglones: 1500, moneda: 'ARS', tipo_cambio: 1 }),
      );
      expect(m.titulo).toBe('La factura no coincide con lo recibido');
      expect(m.detalle).toContain('$500,00');
      expect(m.detalle).toContain('$1.500,00');
      expect(m.detalle).toContain('confirmala');
      expect(m.detalle).toContain('corregí el neto');
      expect(m.detalle).not.toContain('al cambio');
      // Se resuelve en la misma pantalla: no hay a dónde mandar un botón.
      expect(m.accion).toBeUndefined();
    });

    it('en una orden en dólares aclara el cambio y que la factura va en pesos', () => {
      const m = interpretarError(
        respuesta({ code: 'FACTURA_DIFIERE', message: 'x', neto: 90, renglones: 108900, moneda: 'USD', tipo_cambio: 1210 }),
      );
      expect(m.detalle).toContain('$108.900,00 al cambio de la entrega');
      expect(m.detalle).toContain('$1.210,00 por USD');
      expect(m.detalle).toContain('en pesos');
    });

    it('sin los montos sigue diciendo qué hacer', () => {
      const m = interpretarError(respuesta({ code: 'FACTURA_DIFIERE', message: 'x' }));
      expect(m.detalle).toContain('corregí el neto');
      expect(m.detalle).not.toContain('undefined');
      expect(m.detalle).not.toContain('NaN');
    });
  });

  it('traduce los errores de Mercado Libre con la ruta a Configuración → Mercado Libre', () => {
    const noConectado = interpretarError(respuesta({ code: 'ML_NO_CONECTADO', message: 'x' }));
    expect(noConectado.titulo).toBe('Mercado Libre no está conectado');
    expect(noConectado.accion).toEqual({ texto: 'Conectar', ruta: '/home/configuracion/mercado-libre' });
    const reautorizar = interpretarError(respuesta({ code: 'ML_REAUTORIZAR', message: 'x' }));
    expect(reautorizar.accion?.texto).toBe('Volver a conectar');
    expect(interpretarError(respuesta({ code: 'ML_NO_DISPONIBLE', message: 'x' })).accion).toBeUndefined();
    expect(interpretarError(respuesta({ code: 'ML_CATEGORIA_INVALIDA', message: 'x' })).titulo).toContain('categoría');
  });

  it('los códigos de la venta de mostrador muestran el mensaje del backend', () => {
    const m = interpretarError(respuesta({ code: 'DESCUENTO_EXCEDIDO', message: 'El descuento de 15.0% pasa el tope de 10%.' }));
    expect(m.titulo).toBe('El descuento pasa el tope');
    expect(m.detalle).toBe('El descuento de 15.0% pasa el tope de 10%.');
    for (const code of ['VENTA_SIN_RENGLONES', 'VENTA_SIN_COBRO', 'COBRO_EXCEDE_SALDO', 'DEVOLUCION_EXCEDE', 'DEVOLUCION_SIN_BILLETERA', 'PAGO_YA_RESUELTO']) {
      expect(interpretarError(respuesta({ code, message: 'texto del backend' })).detalle).toBe('texto del backend');
    }
  });
});

describe('interpretarError: abono', () => {
  const pantalla = { texto: 'Ver el abono', ruta: '/home/configuracion/abono' };

  it('sólo lectura: explica qué se puede hacer y lleva al abono', () => {
    const m = interpretarError(respuesta({ code: 'TALLER_SOLO_LECTURA', message: 'x' }, 403));
    expect(m.titulo).toBe('El abono del taller venció');
    expect(m.detalle).toContain('ver y exportar todo');
    expect(m.accion).toEqual(pantalla);
  });

  it('tope del plan gratis: dice el tope y lleva al abono', () => {
    const m = interpretarError(respuesta({ code: 'TOPE_PLAN_GRATIS', message: 'x', tope: 30, usadas: 30 }));
    expect(m.titulo).toBe('Llegaste al tope del plan gratis');
    expect(m.detalle).toContain('30 unidades en stock');
    expect(m.accion).toEqual(pantalla);
  });

  it('abono no disponible: lo dice en castellano, sin una salida que no existe', () => {
    const m = interpretarError(respuesta({ code: 'ABONO_NO_DISPONIBLE', message: 'x' }, 503));
    expect(m.titulo).toBe('No se pudo iniciar el pago');
    expect(m.detalle).toContain('Probá de nuevo');
    expect(m.accion).toBeUndefined();
  });
});
