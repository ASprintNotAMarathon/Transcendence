// Per Kimia's Auth contract: displayName is 3-20 characters, letters, digits, underscore, hyphen.
export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/
export const DISPLAY_NAME_MESSAGE = 'Use 3 to 20 letters, numbers, underscores or hyphens.'