export const WORKSPACE_IMAGE_RESIZE_RULES = {
  dcl: {
    label: '待处理图',
    maxLongEdge: 0,
    maxTotalPixels: 2400000,
    outputType: 'image/jpeg'
  },
  ck: {
    label: '参考图',
    maxLongEdge: 2048,
    maxTotalPixels: 3000000
  }
}

export const getWorkspaceImageResizeRule = (type) => {
  return WORKSPACE_IMAGE_RESIZE_RULES[type] || WORKSPACE_IMAGE_RESIZE_RULES.dcl
}

export const computeImageResizePlan = (width, height, rule = {}) => {
  const safeWidth = Math.max(1, Math.round(Number(width) || 0))
  const safeHeight = Math.max(1, Math.round(Number(height) || 0))
  const maxLongEdge = Number(rule.maxLongEdge) || 0
  const maxTotalPixels = Number(rule.maxTotalPixels) || 0
  const originalPixels = safeWidth * safeHeight
  const longestEdge = Math.max(safeWidth, safeHeight)
  const longEdgeExceeded = maxLongEdge > 0 && longestEdge > maxLongEdge
  const totalPixelsExceeded = maxTotalPixels > 0 && originalPixels > maxTotalPixels

  let targetWidth = safeWidth
  let targetHeight = safeHeight

  if (longEdgeExceeded || totalPixelsExceeded) {
    let scale = 1
    if (longEdgeExceeded) {
      scale = Math.min(scale, maxLongEdge / longestEdge)
    }
    if (totalPixelsExceeded) {
      scale = Math.min(scale, Math.sqrt(maxTotalPixels / originalPixels))
    }

    targetWidth = Math.max(1, Math.floor(safeWidth * scale))
    targetHeight = Math.max(1, Math.floor(safeHeight * scale))

    if (maxTotalPixels > 0) {
      const ratio = safeWidth / safeHeight
      const idealWidth = Math.sqrt(maxTotalPixels * ratio)
      const idealHeight = Math.sqrt(maxTotalPixels / ratio)
      const candidateWidths = [
        Math.floor(idealWidth),
        Math.ceil(idealWidth),
        targetWidth - 1,
        targetWidth,
        targetWidth + 1
      ]
      const candidateHeights = [
        Math.floor(idealHeight),
        Math.ceil(idealHeight),
        targetHeight - 1,
        targetHeight,
        targetHeight + 1
      ]

      const collectCandidate = (w, h) => {
        const nextWidth = Math.max(1, Math.min(safeWidth, Math.round(w)))
        const nextHeight = Math.max(1, Math.min(safeHeight, Math.round(h)))
        if (maxLongEdge > 0 && Math.max(nextWidth, nextHeight) > maxLongEdge) return null
        const area = nextWidth * nextHeight
        if (area > maxTotalPixels) return null
        const ratioError = Math.abs(nextWidth / nextHeight - ratio)
        return { nextWidth, nextHeight, area, ratioError }
      }

      let best = collectCandidate(targetWidth, targetHeight)
      candidateWidths.forEach((w) => {
        if (!Number.isFinite(w) || w <= 0) return
        const fromWidth = collectCandidate(w, w / ratio)
        if (fromWidth && (!best || fromWidth.area > best.area || (fromWidth.area === best.area && fromWidth.ratioError < best.ratioError))) {
          best = fromWidth
        }
      })
      candidateHeights.forEach((h) => {
        if (!Number.isFinite(h) || h <= 0) return
        const fromHeight = collectCandidate(h * ratio, h)
        if (fromHeight && (!best || fromHeight.area > best.area || (fromHeight.area === best.area && fromHeight.ratioError < best.ratioError))) {
          best = fromHeight
        }
      })

      if (best) {
        targetWidth = best.nextWidth
        targetHeight = best.nextHeight
      }
    }
  }
  const resized = targetWidth !== safeWidth || targetHeight !== safeHeight
  const scale = Math.min(targetWidth / safeWidth, targetHeight / safeHeight)

  return {
    originalWidth: safeWidth,
    originalHeight: safeHeight,
    targetWidth,
    targetHeight,
    originalPixels,
    targetPixels: targetWidth * targetHeight,
    maxLongEdge,
    maxTotalPixels,
    longEdgeExceeded,
    totalPixelsExceeded,
    resized,
    scale
  }
}

const readImageDimensions = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  image.onload = () => {
    resolve({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
      image
    })
  }

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error('图片读取失败，无法执行自动缩放'))
  }

  image.src = objectUrl
})

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('图片缩放失败，无法导出'))
      return
    }
    resolve(blob)
  }, type, quality)
})

export const resizeImageFileForWorkspace = async (type, file) => {
  const rule = getWorkspaceImageResizeRule(type)
  const { width, height, cleanup, image } = await readImageDimensions(file)

  try {
    const plan = computeImageResizePlan(width, height, rule)
    const forceJpeg = type === 'dcl'
    const needsTransform = plan.resized || forceJpeg

    if (!needsTransform) {
      return {
        file,
        resized: false,
        converted: false,
        rule,
        plan
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = plan.targetWidth
    canvas.height = plan.targetHeight

    const outputType = forceJpeg
      ? 'image/jpeg'
      : (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg')
    const context = canvas.getContext('2d', { alpha: outputType === 'image/png' })
    if (!context) {
      throw new Error('图片缩放失败，无法创建画布上下文')
    }

    if (outputType === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, plan.targetWidth, plan.targetHeight)
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, plan.targetWidth, plan.targetHeight)

    const quality = outputType === 'image/png' ? undefined : 0.92
    const blob = await canvasToBlob(canvas, outputType, quality)
    const resizedFile = new File([blob], file.name, {
      type: blob.type || outputType,
      lastModified: file.lastModified
    })

    return {
      file: resizedFile,
      resized: plan.resized,
      converted: forceJpeg,
      rule,
      plan
    }
  } finally {
    cleanup()
  }
}
