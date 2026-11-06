export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

const AVATAR_MAX_MB = AVATAR_MAX_BYTES / (1024 * 1024)

export const AVATAR_HINT = `JPEG, PNG or WebP, up to ${AVATAR_MAX_MB} MB.`
export const AVATAR_TOO_LARGE = `This file is too large. The maximum is ${AVATAR_MAX_MB} MB.`

// Gives back an error msg or null if file is correct
export function checkAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return 'Please choose a JPEG, PNG or WebP image.'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return AVATAR_TOO_LARGE
  }
  return null
}