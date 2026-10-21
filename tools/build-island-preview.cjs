// Offline preview of the actual splash only; no separate landing page.
const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2];
if (!output) throw new Error('请指定海岛开屏预览输出目录');
const source = path.resolve(__dirname, '../client/src');
const logo = fs.readFileSync(path.join(source, 'assets/brand/island-logo.svg'), 'utf8');
const template = fs.readFileSync(path.join(source, 'components/startup/island.html'), 'utf8');
const animation = fs.readFileSync(path.join(source, 'components/startup/island.js'), 'utf8').replace('export function', 'function');
const fontDir = path.resolve(source, '../node_modules/animal-island-vue/dist/files');
const fonts = [
  ['Nunito', 500, 'nunito-latin-500-normal.78b3b3a4.woff2'],
  ['Nunito', 700, 'nunito-latin-700-normal.0b62b606.woff2'],
  ['Noto Sans SC', 500, 'noto-sans-sc-chinese-simplified-500-normal.d3553b6f.woff2'],
  ['Noto Sans SC', 700, 'noto-sans-sc-chinese-simplified-700-normal.6e0a7691.woff2']
];
const fontCss = fonts.map(([family, weight, file]) => {
  const data = fs.readFileSync(path.join(fontDir, file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url('data:font/woff2;base64,${data}') format('woff2')}`;
}).join('\n');
const preview = template.replace('__ISLAND_LOGO__', logo)
  .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vivid4Free · 海岛开屏</title>')
  .replace('</style>', `${fontCss}\n.island-skip[hidden]{display:none}</style>`)
  .replace('</button></div>', '</button><button class="island-skip" id="replay" type="button" hidden>重播 ↻</button></div>')
  .replace('</body>', `<script>
  ${animation}
  const intro = document.getElementById('island-intro');
  const skip = document.getElementById('skip');
  const replay = document.getElementById('replay');
  let dispose;
  function play() {
    dispose?.();
    skip.hidden = false;
    replay.hidden = true;
    intro.classList.remove('playing');
    void intro.offsetWidth;
    dispose = runIntroAnimation(document, reason => {
      // Settle only the finite reveal; scene motion keeps running until removal.
      intro.getAnimations({ subtree: true }).forEach(motion => {
        if (motion.effect.getTiming().iterations !== Infinity) motion.finish();
      });
      skip.hidden = true;
      replay.hidden = false;
      replay.focus({ preventScroll: true });
      window.dispatchEvent(new CustomEvent('vivid:splash-complete', { detail: { reason } }));
    });
  }
  replay.addEventListener('click', play);
  play();
  </script></body>`);
fs.mkdirSync(path.resolve(output, 'fonts'), { recursive: true });
for (const [, , file] of fonts) fs.copyFileSync(path.join(fontDir, file), path.resolve(output, 'fonts', file));
fs.copyFileSync(path.resolve(source, '../THIRD-PARTY-NOTICES.txt'), path.resolve(output, 'THIRD-PARTY-NOTICES.txt'));
fs.writeFileSync(path.resolve(output, 'index.html'), preview);
fs.writeFileSync(path.resolve(output, 'island-logo.svg'), logo);
console.log(path.resolve(output, 'index.html'));
