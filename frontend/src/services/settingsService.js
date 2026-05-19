import api from '../api/axios';

const settingsService = {
  getMySettings: async () => {
    const response = await api.get('/settings/me');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/settings/profile', profileData);
    return response.data;
  },

  updateTheme: async (themePreference) => {
    const response = await api.put('/settings/theme', { themePreference });
    return response.data;
  },

  updateNotifications: async (notificationData) => {
    const response = await api.put('/settings/notifications', notificationData);
    return response.data;
  },

  updatePrivacy: async (privacyData) => {
    const response = await api.put('/settings/privacy', privacyData);
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
