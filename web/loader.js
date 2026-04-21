'use strict';

// CommonJS shim — loads src/ modules in dependency order for the browser.
(async () => {
  const loaded = {};

  async function req(filePath) {
    if (loaded[filePath]) return loaded[filePath];

    const text = await fetch(filePath).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${filePath}: ${r.status}`);
      return r.text();
    });

    const mod = { exports: {} };
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    function localRequire(dep) {
      if (dep.startsWith('.')) {
        let resolved = dir + '/' + dep.replace(/^\.\//, '');
        if (!resolved.endsWith('.js')) resolved += '.js';
        if (loaded[resolved]) return loaded[resolved];
        throw new Error(`Module not loaded yet: ${resolved} (required by ${filePath})`);
      }
      return loaded[dep];
    }

    // Wrap in function to provide CommonJS globals
    const fn = new Function('module', 'exports', 'require', '__filename', '__dirname', text);
    fn(mod, mod.exports, localRequire, filePath, dir);
    loaded[filePath] = mod.exports;
    return mod.exports;
  }

  try {
    const utils     = await req('/src/utils.js');
    const cards     = await req('/src/cards.js');
    const augments  = await req('/src/augments.js');
    const items     = await req('/src/items.js');
    const board     = await req('/src/board.js');
    const shop      = await req('/src/shop.js');
    const opponents = await req('/src/opponents.js');
    const game      = await req('/src/game.js');
    const sim       = await req('/src/sim.js');

    window.ACB = { utils, cards, augments, items, board, shop, opponents, game, sim };
    document.dispatchEvent(new CustomEvent('acb-ready'));
  } catch (e) {
    console.error('ACB loader failed:', e);
    document.body.innerHTML = `<pre style="color:red;padding:2rem">Loader error:\n${e.message}\n${e.stack}</pre>`;
  }
})();
