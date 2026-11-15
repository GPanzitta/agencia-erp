import { esCampoDeTexto, esMenu, hayModalAbierto, gestoHorizontal } from './gestos.util';

describe('esCampoDeTexto', () => {
  it('input, textarea, select y contenteditable son campos; un botón, el body o nada no', () => {
    expect(esCampoDeTexto(document.createElement('input'))).toBeTrue();
    expect(esCampoDeTexto(document.createElement('textarea'))).toBeTrue();
    expect(esCampoDeTexto(document.createElement('select'))).toBeTrue();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(esCampoDeTexto(editable)).toBeTrue();
    expect(esCampoDeTexto(document.createElement('button'))).toBeFalse();
    expect(esCampoDeTexto(document.body)).toBeFalse();
    expect(esCampoDeTexto(null)).toBeFalse();
  });
});

describe('esMenu', () => {
  it('un menú abierto (menu, menuitem o su disparador desplegado) cuenta; un botón suelto no', () => {
    const menu = document.createElement('ul');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    item.setAttribute('role', 'menuitem');
    menu.appendChild(item);
    expect(esMenu(menu)).toBeTrue();
    expect(esMenu(item)).toBeTrue();
    const disparador = document.createElement('button');
    disparador.setAttribute('aria-haspopup', 'menu');
    disparador.setAttribute('aria-expanded', 'false');
    expect(esMenu(disparador)).toBeFalse();
    disparador.setAttribute('aria-expanded', 'true');
    expect(esMenu(disparador)).toBeTrue();
    expect(esMenu(document.createElement('button'))).toBeFalse();
    expect(esMenu(null)).toBeFalse();
  });
});

describe('hayModalAbierto', () => {
  it('detecta un overlay o un role=dialog en el documento, y nada cuando no hay', () => {
    expect(hayModalAbierto()).toBeFalse();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    expect(hayModalAbierto()).toBeTrue();
    overlay.remove();
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    document.body.appendChild(dlg);
    expect(hayModalAbierto()).toBeTrue();
    dlg.remove();
  });
});

describe('gestoHorizontal', () => {
  it('más de 60 px en horizontal pasa de orden: a la izquierda la siguiente, a la derecha la anterior', () => {
    expect(gestoHorizontal(-80, 10)).toBe('siguiente');
    expect(gestoHorizontal(75, -20)).toBe('anterior');
  });

  it('corto, o más vertical que horizontal (el scroll de la página), no hace nada', () => {
    expect(gestoHorizontal(-59, 0)).toBeNull();
    expect(gestoHorizontal(-90, 120)).toBeNull();
    expect(gestoHorizontal(0, 0)).toBeNull();
  });
});
