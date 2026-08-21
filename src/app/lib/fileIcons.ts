import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileVideo,
  FileAudio,
  FileCode,
  FileType as FilePdf,
  File as FileGeneric,
  type LucideIcon,
} from 'lucide-react';

/**
 * Resolves the appropriate lucide icon for a document based on its MIME type
 * (fileType) and/or file name extension, so each document shows a type-specific
 * icon instead of a generic one.
 */
export function getFileIcon(fileType?: string, fileName?: string): LucideIcon {
  const type = (fileType || '').toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  const is = (needle: string) => type.includes(needle) || ext === needle;

  if (type.includes('pdf') || ext === 'pdf') return FilePdf;
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return FileSpreadsheet;
  if (type.includes('zip') || type.includes('rar') || type.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return FileVideo;
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return FileAudio;
  if (is('json') || is('xml') || is('html') || ['js', 'ts', 'tsx', 'jsx', 'css', 'py', 'java'].includes(ext)) return FileCode;
  if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return FileText;

  return FileGeneric;
}
