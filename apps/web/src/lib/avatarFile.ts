export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_HINT = 'JPEG, PNG or WebP, up to 5 MB.'

// Geeft een foutmelding terug, of null als het bestand goed is.
export function checkAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return 'Please choose a JPEG, PNG or WebP image.'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'This file is too large. The maximum is 5 MB.'
  }
  return null
}