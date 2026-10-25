param([Parameter(Mandatory)][string]$Path)
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $Path
if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or -not $signature.TimeStamperCertificate) {
    throw "发行文件需要有效的受信任 Authenticode 签名及时间戳：$Path"
}
if ($env:VIVID_SIGNING_CERT_SHA1 -and $signature.SignerCertificate.Thumbprint -ne $env:VIVID_SIGNING_CERT_SHA1) {
    throw "发行文件的签名证书与指定证书不符：$Path"
}
Write-Output "签名和时间戳验证通过：$Path"
