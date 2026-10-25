export function runtimePackageHint(status) {
  const size = bytes => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.ceil(bytes / 1e6)} MB`
  if (!status?.available) return '请检查更新以获取兼容的引擎下载入口，或导入已支持的官方引擎 ZIP。'
  if (status.availableCompatible === false) return '下载源的引擎尚不支持当前客户端，请先更新客户端或使用已支持的引擎。'
  return status.recommendedPackage === 'incremental'
    ? `建议下载 ${status.incrementalBaseVersion} → ${status.availableVersion} 增量包${status.incrementalPackageBytes ? `（${size(status.incrementalPackageBytes)}）` : ''}；也可使用全量包。`
    : `请下载全量包${status.fullPackageBytes ? `（${size(status.fullPackageBytes)}）` : ''}，适合首次安装或跨版本升级。`
}
