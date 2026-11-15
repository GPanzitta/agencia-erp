// Karma sólo para correr la suite completa en esta máquina: no hay Chrome
// instalado y con Edge headless, bajo carga (tres dev servers levantados), el
// navegador se desconecta antes de terminar las ~930 pruebas. Los timeouts de
// abajo son los defaults multiplicados; no cambian ninguna prueba.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    reporters: ['progress'],
    browsers: ['ChromeHeadless'],
    browserDisconnectTimeout: 30000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: 120000,
    captureTimeout: 120000,
    restartOnFileChange: false,
  });
};
