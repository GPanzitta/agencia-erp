import { correoValido, enlaceDeWhatsapp, renderizarPlantilla, variablesDesconocidas } from './mensajes.util';

describe('mensajes al cliente', () => {
  it('la línea de una variable vacía desaparece; igual que en el servidor', () => {
    const texto = 'Hola {cliente}\nSaldo: {saldo}\n\nGracias.';
    expect(renderizarPlantilla(texto, { cliente: 'Ana', saldo: '' })).toBe('Hola Ana\n\nGracias.');
    expect(renderizarPlantilla(texto, { cliente: 'Ana', saldo: 'US$ 500' })).toBe('Hola Ana\nSaldo: US$ 500\n\nGracias.');
    expect(renderizarPlantilla('Hola {clente}', { cliente: 'Ana' })).toBe('Hola {clente}');
  });

  it('avisa las variables que ese tipo de mensaje no tiene', () => {
    expect(variablesDesconocidas('Hola {cliente}, {saldo} {saldo}', ['cliente'])).toEqual(['saldo']);
  });

  it('arma el enlace de WhatsApp con el texto codificado', () => {
    expect(enlaceDeWhatsapp('5491155550199', 'Hola Ana, ¿venís?\nTe espero')).toBe('https://wa.me/5491155550199?text=Hola%20Ana%2C%20%C2%BFven%C3%ADs%3F%0ATe%20espero');
  });

  it('reconoce un correo bien escrito', () => {
    expect(correoValido(' ana@example.com ')).toBe(true);
    expect(correoValido('ana@example')).toBe(false);
  });
});
