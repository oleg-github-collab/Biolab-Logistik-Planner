export const getAssetUrl = (value) => {
  if (!value) return '';
  if (typeof window === 'undefined') return value;

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${window.location.origin}${normalized}`;
};

export default getAssetUrl;
