/* La Nuit aux Trousses — QR code d’invitation au Duel de la Nuit noire.
   Génère un QR code 100 % local (aucun service externe, fonctionne hors-ligne
   et dans l’édition autonome) à partir du lien d’invitation. S’appuie sur le
   générateur MIT « qrcode-generator » (Kazuhiko Arase) embarqué dans qrcode.js.
   Partagé entre le navigateur (window.NightDuelQR) et les tests Node (CommonJS). */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NightDuelQR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Résout le générateur : global `qrcode` posé par qrcode.js dans le navigateur,
  // ou require('./qrcode.js') côté Node. Résolution paresseuse (à l’appel).
  function getFactory() {
    if (typeof qrcode === 'function') return qrcode;
    if (typeof require === 'function') {
      try {
        return require('./qrcode.js');
      } catch (_) {}
    }
    return null;
  }

  function available() {
    return Boolean(getFactory());
  }

  function escapeAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  // Construit la matrice du QR. `ecl` : niveau de correction L/M/Q/H (M par défaut).
  // typeNumber 0 = taille automatique ajustée au contenu.
  function matrix(text, opts = {}) {
    const factory = getFactory();
    if (!factory) throw new Error('Générateur QR indisponible.');
    const value = String(text ?? '');
    if (!value) throw new Error('Lien d’invitation vide.');
    const qr = factory(0, opts.ecl || 'M');
    qr.addData(value);
    qr.make();
    const size = qr.getModuleCount();
    return { size, isDark: (r, c) => qr.isDark(r, c) };
  }

  // SVG vectoriel net (crispEdges), zone de silence de `margin` modules,
  // fort contraste noir/blanc pour une lecture fiable par l’appareil photo.
  function svg(text, opts = {}) {
    const { size, isDark } = matrix(text, opts);
    const margin = opts.margin == null ? 4 : opts.margin;
    const dim = size + margin * 2;
    const dark = opts.dark || '#000000';
    const light = opts.light || '#ffffff';
    const title = escapeAttr(opts.title || 'QR code d’invitation au duel');
    let path = '';
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
      `shape-rendering="crispEdges" role="img" aria-label="${title}" focusable="false">` +
      `<title>${title}</title>` +
      `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
      `<path d="${path}" fill="${dark}"/></svg>`;
  }

  // PNG téléchargeable (navigateur uniquement). Renvoie null si le canvas ou le
  // générateur n’est pas disponible — l’appelant affiche alors un message doux.
  function pngDataUrl(text, opts = {}) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    let canvas;
    try {
      const { size, isDark } = matrix(text, opts);
      const margin = opts.margin == null ? 4 : opts.margin;
      const scale = opts.scale || 12;
      const dim = (size + margin * 2) * scale;
      canvas = document.createElement('canvas');
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx || typeof canvas.toDataURL !== 'function') return null;
      ctx.fillStyle = opts.light || '#ffffff';
      ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = opts.dark || '#000000';
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          if (isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
      }
      return canvas.toDataURL('image/png');
    } catch (_) {
      return null;
    }
  }

  return Object.freeze({ available, matrix, svg, pngDataUrl });
});
