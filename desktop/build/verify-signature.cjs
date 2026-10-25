const path = require('node:path');
const { execFileSync } = require('node:child_process');

function verify(file) {
  if (process.platform !== 'win32') throw new Error('发行签名验收须在 Windows 执行');
  execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'verify-signature.ps1'), '-Path', file],
    { stdio: 'inherit', windowsHide: true, timeout: 60000 });
}
module.exports = async context => {
  if (context.packager?.config?.win?.signExecutable === false) return;
  if (context.file) {
    if (context.file.toLowerCase().endsWith('.exe')) verify(context.file);
  } else {
    verify(path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`));
  }
};
module.exports.verify = verify;
