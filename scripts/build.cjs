const fs = require('fs');
const esbuild = require('esbuild');

fs.mkdirSync('dist', { recursive: true });

esbuild.buildSync({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  minify: true,
  loader: { '.png': 'dataurl' },
  external: ['/assets/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  target: 'es2020'
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mealday</title>
  <link rel="stylesheet" href="app.css" />
</head>
<body>
  <div id="root"></div>
  <script src="app.js"></script>
</body>
</html>`;

fs.writeFileSync('dist/index.html', html, 'utf-8');
