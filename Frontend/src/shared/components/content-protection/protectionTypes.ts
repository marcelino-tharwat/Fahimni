export interface ProtectionPolicy {
  disableCopy?: boolean
  disableCut?: boolean
  disablePaste?: boolean
  disableContextMenu?: boolean
  disableSelection?: boolean
  disablePrint?: boolean
  disableDragStart?: boolean
  blurOnHidden?: boolean
}

export type BlockedAction = 'copy' | 'cut' | 'paste' | 'contextmenu' | 'print'

export const BLOCKED_MESSAGES: Record<BlockedAction, string> = {
  copy: 'تم تعطيل النسخ داخل هذا المحتوى',
  cut: 'تم تعطيل القص داخل هذا المحتوى',
  paste: 'تم تعطيل اللصق داخل هذا الاختبار',
  contextmenu: 'تم تعطيل قائمة السياق لهذا المحتوى',
  print: 'تم تعطيل الطباعة لهذا المحتوى',
}
