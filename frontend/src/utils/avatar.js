/**
 * Utility to resolve profile image paths to absolute URLs.
 * Handles full HTTP URLs and relative `/api/settings/profile-image/:storageKey` paths.
 */
export const getAvatarUrl = (profileImage) => {
  if (!profileImage) return null;
  
  if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
    return profileImage;
  }
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
  const cleanPath = profileImage.startsWith('/') ? profileImage : `/${profileImage}`;
  
  return `${baseUrl}${cleanPath}`;
};
