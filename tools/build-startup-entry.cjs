const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../client/node_modules/esbuild');

const outfile = process.argv[2];
if (!outfile) throw new Error('请指定开屏模块输出文件');
build({
  entryPoints: [path.resolve(__dirname, '../client/src/startup-entry.js')],
  outfile: path.resolve(outfile), bundle: true, minify: true, format: 'iife',
  plugins: [{ name: 'intro-html', setup(builder) {
    builder.onResolve({ filter: /\.(?:html|svg)\?raw$/ }, args => ({
      path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'intro-html'
    }));
    builder.onLoad({ filter: /.*/, namespace: 'intro-html' }, args => ({
      contents: fs.readFileSync(args.path, 'utf8'), loader: 'text'
    }));
  } }]
}).catch(() => { process.exitCode = 1; });
