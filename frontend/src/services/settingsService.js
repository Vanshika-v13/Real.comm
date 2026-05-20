import api, { setDefaultAuthToken } from '../api/axios';
import { getAuthToken, isRememberMeEnabled, persistAuthToken } from '../utils/authStorage';
import { pickNotificationPatch, pickPrivacyPatch } from '../utils/settingsPatch';

function storeSessionToken(token) {
  if (!token) {
    return;
  }
  persistAuthToken(token, isRememberMeEnabled());
  setDefaultAuthToken(getAuthToken());
}

const settingsService = {
  getMySettings: async () => {
    const response = await api.get('/settings/me');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/settings/profile', profileData);
    return response.data;
  },

  updatePassword: async (passwordData) => {
    const response = await api.put('/settings/password', {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmPassword: passwordData.confirmPassword,
    });
    storeSessionToken(response.data?.data?.token);
    return response.data;
  },

  updateTheme: async (themePreference) => {
    const response = await api.put('/settings/theme', { themePreference });
    return response.data;
  },

  /** Patch notification fields only (server merges with existing). */
  updateNotifications: async (patch) => {
    const safePatch = pickNotificationPatch(patch);
    const response = await api.put('/settings/notifications', safePatch);
    return response.data;
  },

  /** Patch privacy fields only (server merges with existing). */
  updatePrivacy: async (patch) => {
    const safePatch = pickPrivacyPatch(patch);
    const response = await api.put('/settings/privacy', safePatch);
    return response.data;
  },

  uploadProfileImage: async (formData) => {
    const response = await api.post('/settings/profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  removeProfileImage: async () => {
    const response = await api.delete('/settings/profile-image');
    return response.data;
  },
};

export default settingsService;
