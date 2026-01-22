export const getAssetUrl = (value) => {
  if (!value) return '';
  if (typeof window === 'undefined') return value;

  // Already a full URL (http/https/data/blob) - includes Cloudinary URLs
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  // Cloudinary URLs (res.cloudinary.com)
  if (value.includes('cloudinary.com')) {
    return value;
  }

  // Remove 'app/' prefix if it exists (legacy paths)
  let normalized = value.replace(/^app\//, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // In development, use localhost. In production, use relative path
  if (process.env.NODE_ENV === 'development') {
    return `${window.location.origin}${normalized}`;
  }

  // Production: return relative path (works better with Railway's routing)
  return normalized;
};

export default getAssetUrl;
