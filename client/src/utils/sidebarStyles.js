/**
 * 统一的 Sidebar 样式常量
 * 确保所有 LeftPanel 组件使用一致的样式
 */

// 容器样式
export const CONTAINER_STYLES = {
  // 主容器
  main: 'w-[265px] flex flex-col gap-4 m-4',
  
  // 上传区域容器
  uploadArea: 'bg-schemes-surface-container rounded-lg flex flex-col gap-0 items-center justify-center w-[265px] h-[182px] overflow-hidden cursor-pointer transition-colors duration-200 relative',
  uploadAreaHover: 'bg-schemes-surface-container-high',
  
  // 多图上传区域容器
  multiUploadArea: 'bg-schemes-surface-container rounded-lg flex flex-col gap-2 items-center justify-center w-[265px] min-h-[182px] overflow-hidden cursor-pointer transition-colors duration-200 relative',
}

// 图片预览样式
export const IMAGE_PREVIEW_STYLES = {
  // 单图预览容器
  container: 'w-full h-full relative',
  image: 'w-full h-full object-cover rounded-lg',
  
  // 悬停信息叠加层
  overlay: 'absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 rounded-lg',
  fileName: 'text-white text-xs font-medium truncate',
  fileSize: 'text-white text-xs opacity-75',
  
  // 多图预览网格
  multiGrid: 'w-full p-2',
  multiGridContainer: 'grid grid-cols-2 gap-2',
  multiImageItem: 'relative group',
  multiImage: 'w-full h-20 object-cover rounded-lg',
  multiImageInfo: 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate',
}

// 按钮样式
export const BUTTON_STYLES = {
  // 清除按钮
  clear: 'absolute top-2 right-2 w-6 h-6 bg-schemes-error rounded-full flex items-center justify-center hover:bg-opacity-80 transition-colors',
  clearIcon: 'w-4 h-4',
  
  // 多图删除按钮
  multiRemove: 'absolute -top-1 -right-1 w-5 h-5 bg-schemes-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
  multiRemoveIcon: 'w-3 h-3',
  
  // 画笔按钮
  brush: 'absolute top-2 left-2 w-8 h-8 bg-schemes-primary rounded-full flex items-center justify-center hover:bg-opacity-80 transition-colors',
  brushIcon: 'w-5 h-5',

  // 重绘按钮
  redraw: 'absolute bottom-4 right-4 w-10 h-10 bg-schemes-primary rounded-full flex items-center justify-center hover:bg-opacity-80 transition-colors shadow-lg',
  redrawIcon: 'w-6 h-6',
  
  // 主要操作按钮
  primary: 'primary-button flex-1 h-10',
  secondary: 'secondary-button flex-1 h-10',
  buttonContainer: 'w-[265px] flex flex-row gap-3 items-center justify-between',
  buttonContent: 'pt-2.5 pr-2.5 pb-2.5 pl-3 flex flex-row gap-1 items-center justify-center flex-1 relative',
  buttonTextPrimary: 'button-text-primary letter-spacing-m3-title-medium-emphasized',
  buttonTextSecondary: 'button-text-secondary letter-spacing-m3-title-medium-emphasized',
}

// 上传提示样式
export const UPLOAD_PROMPT_STYLES = {
  // 单图上传提示
  container: 'flex flex-col items-center justify-center gap-2',
  icon: 'w-6 h-6',
  title: 'text-schemes-on-surface-variant text-center font-m3-body-medium-font-family text-m3-body-medium-font-size leading-m3-body-medium-line-height font-m3-body-medium-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-medium',
  subtitle: 'text-schemes-outline text-center font-m3-body-small-font-family text-m3-body-small-font-size leading-m3-body-small-line-height font-m3-body-small-font-weight relative w-[243px] h-[30px] flex items-center justify-center letter-spacing-m3-body-small',
  
  // 多图上传提示
  multiContainer: 'flex flex-col items-center justify-center gap-2 p-4',
  multiTitle: 'text-schemes-on-surface-variant text-sm font-m3-body-medium-font-family text-center',
  multiSubtitle: 'text-schemes-on-surface-variant text-xs text-center',
}

// 表单字段样式
export const FORM_FIELD_STYLES = {
  // 字段容器
  container: 'flex flex-col gap-2',
  label: 'text-schemes-on-surface-variant text-sm font-m3-label-medium-font-family font-m3-label-medium-font-weight letter-spacing-m3-label-medium',
  
  // 输入框
  input: 'input-field text-schemes-on-surface text-sm font-m3-body-medium-font-family focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors',
  textarea: 'input-field min-h-[80px] text-schemes-on-surface text-sm font-m3-body-medium-font-family resize-none focus:outline-none focus:ring-2 focus:ring-schemes-primary transition-colors',
  placeholder: 'placeholder:text-schemes-on-surface-variant',
}

// 分隔线样式
export const DIVIDER_STYLES = {
  horizontal: 'border-solid border-schemes-outline-variant border-t w-[265px] h-0 -mt-1',
}

// 信息展示样式
export const INFO_DISPLAY_STYLES = {
  // 生成信息
  container: 'text-xs text-schemes-on-surface-variant text-center',
  count: 'text-schemes-primary font-medium',
}

// 高级参数样式
export const ADVANCED_PARAMS_STYLES = {
  container: 'w-[265px]',
  button: 'flex w-full justify-between rounded-lg bg-schemes-surface-container px-4 py-2 text-left text-sm font-medium text-schemes-on-surface hover:bg-schemes-surface-container-high focus:outline-none focus-visible:ring focus-visible:ring-schemes-primary focus-visible:ring-opacity-75',
  icon: 'h-5 w-5 text-schemes-on-surface transition-transform',
  iconRotated: 'rotate-180 transform',
  panel: 'mt-4',
  transition: {
    enterActive: 'transition duration-200 ease-out',
    enterFrom: 'transform scale-95 opacity-0',
    enterTo: 'transform scale-100 opacity-100',
    leaveActive: 'transition duration-75 ease-in',
    leaveFrom: 'transform scale-100 opacity-100',
    leaveTo: 'transform scale-95 opacity-0',
  }
}

// 输入框通用样式类
export const INPUT_CLASSES = 'input-field'

// 常用组合样式
export const COMMON_COMBINATIONS = {
  // 标准字段组合
  standardField: {
    container: FORM_FIELD_STYLES.container,
    label: FORM_FIELD_STYLES.label,
    input: `${FORM_FIELD_STYLES.input} ${FORM_FIELD_STYLES.placeholder}`,
    textarea: `${FORM_FIELD_STYLES.textarea} ${FORM_FIELD_STYLES.placeholder}`,
  },
  
  // 标准按钮组合
  standardButtons: {
    container: BUTTON_STYLES.buttonContainer,
    primary: BUTTON_STYLES.primary,
    secondary: BUTTON_STYLES.secondary,
    content: BUTTON_STYLES.buttonContent,
    textPrimary: BUTTON_STYLES.buttonTextPrimary,
    textSecondary: BUTTON_STYLES.buttonTextSecondary,
  },
  
  // 标准上传区域组合
  standardUpload: {
    container: CONTAINER_STYLES.uploadArea,
    hoverState: CONTAINER_STYLES.uploadAreaHover,
    promptContainer: UPLOAD_PROMPT_STYLES.container,
    icon: UPLOAD_PROMPT_STYLES.icon,
    title: UPLOAD_PROMPT_STYLES.title,
    subtitle: UPLOAD_PROMPT_STYLES.subtitle,
  },
}

export default {
  CONTAINER_STYLES,
  IMAGE_PREVIEW_STYLES,
  BUTTON_STYLES,
  UPLOAD_PROMPT_STYLES,
  FORM_FIELD_STYLES,
  DIVIDER_STYLES,
  INFO_DISPLAY_STYLES,
  ADVANCED_PARAMS_STYLES,
  INPUT_CLASSES,
  COMMON_COMBINATIONS,
}
