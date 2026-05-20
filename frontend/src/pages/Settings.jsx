import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, FiMoon, FiBell, FiLock, FiCamera, 
  FiCheck, FiX, FiLoader, FiTrash2, FiShield,
  FiChevronRight, FiMenu
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import settingsService from '../services/settingsService';
import { getAvatarUrl } from '../utils/avatar';
import { getSettingsErrorMessage } from '../utils/settingsErrors';

const Settings = () => {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const { changeTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({ name: '', username: '', bio: '' });
  const [profileErrors, setProfileErrors] = useState({ name: '', username: '' });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [themePreference, setThemePreference] = useState(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    messages: true,
    meetings: true,
    mentions: true,
  });
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: true,
    allowRoomInvites: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const applySettingsToState = (settings) => {
    if (!settings) return;

    setProfileData({
      name: settings.fullName || settings.name || '',
      username: settings.username || '',
      bio: settings.bio || '',
    });
    const pref = (settings.themePreference === 'light' || settings.themePreference === 'dark')
      ? settings.themePreference
      : 'dark';
    setThemePreference(pref);
    localStorage.setItem('theme', pref);
    changeTheme(pref);
    setNotificationSettings({
      sound: settings.notificationSettings?.sound ?? true,
      messages: settings.notificationSettings?.messages ?? true,
      meetings: settings.notificationSettings?.meetings ?? true,
      mentions: settings.notificationSettings?.mentions ?? true,
    });
    setPrivacySettings({
      showOnlineStatus: settings.privacySettings?.showOnlineStatus ?? true,
      allowRoomInvites: settings.privacySettings?.allowRoomInvites ?? true,
    });
    setUser((prev) => ({ ...prev, ...settings }));
  };

  const fetchSettings = async (silent = false) => {
    try {
      if (!silent) setFetching(true);
      const response = await settingsService.getMySettings();
      applySettingsToState(response.data?.settings);
    } catch (error) {
      toast(getSettingsErrorMessage(error, 'Failed to fetch settings'), 'error');
    } finally {
      if (!silent) setFetching(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileErrors({ name: '', username: '' });

    if (!profileData.name.trim()) {
      setProfileErrors(prev => ({ ...prev, name: 'Full Name is required' }));
      return;
    }
    if (!profileData.username.trim()) {
      setProfileErrors(prev => ({ ...prev, username: 'Username is required' }));
      return;
    }

    try {
      setLoading(true);
      await settingsService.updateProfile({
        fullName: profileData.name,
        username: profileData.username,
        bio: profileData.bio,
      });
      await fetchSettings(true);
      toast('Profile updated successfully', 'success');
    } catch (error) {
      if (error.response?.status === 409) {
        setProfileErrors(prev => ({ ...prev, username: 'Username is already taken' }));
        toast('Username is already taken', 'error');
      } else {
        toast(getSettingsErrorMessage(error, 'Failed to update profile'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });

    let hasError = false;
    if (!passwordData.currentPassword) {
      setPasswordErrors(prev => ({ ...prev, currentPassword: 'Current password is required' }));
      hasError = true;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordErrors(prev => ({ ...prev, newPassword: 'New password must be at least 8 characters' }));
      hasError = true;
    }
    if (passwordData.newPassword === passwordData.currentPassword) {
      setPasswordErrors(prev => ({ ...prev, newPassword: 'New password must be different from current password' }));
      hasError = true;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      hasError = true;
    }

    if (hasError) return;

    try {
      setLoading(true);
      const result = await settingsService.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });
      if (result?.data?.settings) {
        applySettingsToState(result.data.settings);
      } else {
        await fetchSettings(true);
      }
      toast('Password updated successfully', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const message = getSettingsErrorMessage(error, 'Failed to update password');
      if (message.toLowerCase().includes('current password')) {
        setPasswordErrors((prev) => ({ ...prev, currentPassword: message }));
      }
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTheme = async (theme) => {
    try {
      setThemePreference(theme);
      localStorage.setItem('theme', theme);
      changeTheme(theme);
      
      await settingsService.updateTheme(theme);
      await fetchSettings(true);
      toast('Theme updated', 'success');
    } catch (error) {
      toast(getSettingsErrorMessage(error, 'Failed to update theme'), 'error');
    }
  };

  const handleUpdateNotifications = async (key, value) => {
    const previous = notificationSettings[key];
    try {
      setNotificationSettings((prev) => ({ ...prev, [key]: value }));
      const result = await settingsService.updateNotifications({ [key]: value });
      if (result?.data?.settings) {
        applySettingsToState(result.data.settings);
      }
    } catch (error) {
      toast(getSettingsErrorMessage(error, 'Failed to update notifications'), 'error');
      setNotificationSettings((prev) => ({ ...prev, [key]: previous }));
    }
  };

  const handleUpdatePrivacy = async (key, value) => {
    const previous = privacySettings[key];
    try {
      setPrivacySettings((prev) => ({ ...prev, [key]: value }));
      const result = await settingsService.updatePrivacy({ [key]: value });
      if (result?.data?.settings) {
        applySettingsToState(result.data.settings);
      }
    } catch (error) {
      toast(getSettingsErrorMessage(error, 'Failed to update privacy'), 'error');
      setPrivacySettings((prev) => ({ ...prev, [key]: previous }));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await uploadFileHelper(file);
  };

  const uploadFileHelper = async (file) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast('Please upload a PNG, JPG, JPEG, or WEBP image', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image size must be less than 5MB', 'error');
      return;
    }

    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setPendingFile(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      await settingsService.uploadProfileImage(formData);
      setLocalPreview(null);
      await fetchSettings(true);
      toast('Profile image updated successfully', 'success');
    } catch (error) {
      setLocalPreview(null);
      setPendingFile(file);
      toast(getSettingsErrorMessage(error, 'Failed to upload image'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFileHelper(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setUploading(true);
      setLocalPreview(null);
      await settingsService.removeProfileImage();
      await fetchSettings(true);
      toast('Profile image removed successfully', 'success');
    } catch (error) {
      toast(getSettingsErrorMessage(error, 'Failed to remove image'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <FiUser /> },
    { id: 'security', label: 'Security', icon: <FiLock /> },
    { id: 'appearance', label: 'Appearance', icon: <FiMoon /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'privacy', label: 'Privacy', icon: <FiShield /> },
  ];

  if (fetching) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
            />
            <p className="text-secondary animate-pulse">Loading settings...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30 w-full overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 sm:p-6 md:p-8 lg:p-10 max-w-6xl overflow-y-auto">
        <header className="mb-6 sm:mb-8 md:mb-12 flex items-center gap-4">
          <button 
            className="md:hidden p-2 bg-white/5 rounded-xl text-white hover:bg-white/10 shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu size={24} />
          </button>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2 tracking-tight">Settings</h1>
            <p className="text-sm sm:text-base text-secondary font-light">Manage your account preferences and workspace configuration.</p>
          </motion.div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <aside className="col-span-1 lg:col-span-3 overflow-x-auto lg:overflow-visible">
            <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 lg:sticky lg:top-10 min-w-max lg:min-w-0 pb-2 lg:pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 rounded-2xl transition-all duration-300 group
                    ${activeTab === tab.id 
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' 
                      : 'text-secondary hover:text-white hover:bg-white/5 border border-transparent'}
                  `}
                >
                  <div className="flex items-center gap-2 lg:gap-4">
                    <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-primary' : ''}`}>
                      {tab.icon}
                    </span>
                    <span className="font-medium text-sm lg:text-base">{tab.label}</span>
                  </div>
                  <FiChevronRight className={`hidden lg:block transition-transform ${activeTab === tab.id ? 'rotate-90 opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </nav>
          </aside>

          <section className="col-span-1 lg:col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 lg:p-10 border-white/5"
              >
                {activeTab === 'profile' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Profile Settings</h2>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 mb-10 p-6 rounded-3xl border transition-all ${
                          dragActive ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10' : 'bg-white/5 border-white/5'
                        }`}
                      >
                        <div className="relative group shrink-0">
                          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-2xl">
                            {localPreview || user?.profileImage ? (
                              <img src={localPreview || getAvatarUrl(user.profileImage)} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user?.name?.charAt(0) || 'U'
                            )}
                            {uploading && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
                                <FiLoader className="animate-spin text-primary" />
                              </div>
                            )}
                          </div>
                          <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-white text-slate-950 rounded-2xl flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 transition-transform ring-4 ring-background">
                            <FiCamera size={18} />
                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImageUpload} disabled={uploading} />
                          </label>
                        </div>
                        
                        <div className="flex-1 w-full text-center sm:text-left">
                          <h3 className="text-white font-semibold mb-1">Profile Photo</h3>
                          <p className="text-sm text-secondary mb-4 font-light">Drag and drop here, or select to upload. Supports PNG, JPG, JPEG, WEBP up to 5MB.</p>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                            <label className="cursor-pointer px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all">
                              Change Photo
                              <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImageUpload} disabled={uploading} />
                            </label>
                            {user?.profileImage && (
                              <button 
                                onClick={handleRemoveImage}
                                className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                              >
                                <FiTrash2 size={12} /> Remove
                              </button>
                            )}
                            {pendingFile && (
                              <button 
                                onClick={() => uploadFileHelper(pendingFile)}
                                className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold rounded-xl transition-all"
                              >
                                Retry Upload
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Full Name</label>
                          <input 
                            type="text" 
                            value={profileData.name}
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                            placeholder="Your name"
                            required
                          />
                          {profileErrors.name && (
                            <p className="text-xs text-accent mt-1 ml-1">{profileErrors.name}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Username</label>
                          <div className="relative flex items-center">
                            <span className="absolute left-6 text-secondary font-light">@</span>
                            <input 
                              type="text" 
                              value={profileData.username}
                              onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 sm:pl-12 sm:pr-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                              placeholder="username"
                              required
                            />
                          </div>
                          {profileErrors.username && (
                            <p className="text-xs text-accent mt-1 ml-1">{profileErrors.username}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Bio</label>
                          <textarea 
                            value={profileData.bio}
                            onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light min-h-[120px] resize-none"
                            placeholder="Tell us a bit about yourself..."
                          />
                        </div>

                        <div className="pt-4">
                          <Button 
                            type="submit" 
                            className="px-10 h-14 rounded-2xl shadow-xl shadow-primary/20"
                            disabled={loading}
                          >
                            {loading ? <FiLoader className="animate-spin mr-2" /> : <FiCheck className="mr-2" />}
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Security Settings</h2>
                      <p className="text-sm sm:text-base text-secondary font-light mb-6 sm:mb-8 leading-relaxed">
                        Update your password to keep your account secure.
                      </p>

                      <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Current Password</label>
                          <input 
                            type="password" 
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                            placeholder="••••••••"
                            required
                          />
                          {passwordErrors.currentPassword && (
                            <p className="text-xs text-accent mt-1 ml-1">{passwordErrors.currentPassword}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">New Password</label>
                          <input 
                            type="password" 
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                            placeholder="At least 8 characters"
                            required
                          />
                          {passwordErrors.newPassword && (
                            <p className="text-xs text-accent mt-1 ml-1">{passwordErrors.newPassword}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Confirm New Password</label>
                          <input 
                            type="password" 
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                            placeholder="Confirm your new password"
                            required
                          />
                          {passwordErrors.confirmPassword && (
                            <p className="text-xs text-accent mt-1 ml-1">{passwordErrors.confirmPassword}</p>
                          )}
                        </div>

                        <div className="pt-4">
                          <Button 
                            type="submit" 
                            className="px-10 h-14 rounded-2xl shadow-xl shadow-primary/20"
                            disabled={loading}
                          >
                            {loading ? <FiLoader className="animate-spin mr-2" /> : <FiCheck className="mr-2" />}
                            Update Password
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Appearance</h2>
                      <p className="text-sm sm:text-base text-secondary font-light mb-6 sm:mb-8 leading-relaxed">
                        Customize how the application looks for you. Choose a theme that fits your workspace.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <ThemeCard 
                          id="light" 
                          label="Light" 
                          active={themePreference === 'light'} 
                          onClick={() => handleUpdateTheme('light')}
                          preview="bg-slate-100"
                        />
                        <ThemeCard 
                          id="dark" 
                          label="Dark" 
                          active={themePreference === 'dark'} 
                          onClick={() => handleUpdateTheme('dark')}
                          preview="bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Notifications</h2>
                      <p className="text-sm sm:text-base text-secondary font-light mb-6 sm:mb-8 leading-relaxed">
                        Choose what you want to be notified about and how.
                      </p>

                      <div className="space-y-4">
                        <ToggleSetting 
                          label="Sound Effects" 
                          description="Play a sound for incoming messages and alerts."
                          enabled={notificationSettings.sound}
                          onToggle={(val) => handleUpdateNotifications('sound', val)}
                        />
                        <ToggleSetting 
                          label="Direct Messages" 
                          description="Receive updates about direct and room messages."
                          enabled={notificationSettings.messages}
                          onToggle={(val) => handleUpdateNotifications('messages', val)}
                        />
                        <ToggleSetting 
                          label="Meeting Alerts" 
                          description="Get notified when a meeting you're invited to starts."
                          enabled={notificationSettings.meetings}
                          onToggle={(val) => handleUpdateNotifications('meetings', val)}
                        />
                        <ToggleSetting 
                          label="Mentions" 
                          description="Get notified when someone @mentions you in a channel."
                          enabled={notificationSettings.mentions}
                          onToggle={(val) => handleUpdateNotifications('mentions', val)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Privacy & Security</h2>
                      <p className="text-sm sm:text-base text-secondary font-light mb-6 sm:mb-8 leading-relaxed">
                        Control your visibility and who can interact with you.
                      </p>

                      <div className="space-y-4">
                        <ToggleSetting 
                          label="Show Online Status" 
                          description="Let others see when you are active in the workspace."
                          enabled={privacySettings.showOnlineStatus}
                          onToggle={(val) => handleUpdatePrivacy('showOnlineStatus', val)}
                          icon={<FiShield className="text-primary" />}
                        />
                        <ToggleSetting 
                          label="Allow Room Invites" 
                          description="Allow other users to invite you to their rooms."
                          enabled={privacySettings.allowRoomInvites}
                          onToggle={(val) => handleUpdatePrivacy('allowRoomInvites', val)}
                          icon={<FiUser className="text-primary" />}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
};

const ThemeCard = ({ label, active, onClick, preview }) => (
  <button 
    onClick={onClick}
    className={`
      relative p-4 rounded-3xl border transition-all duration-300 text-left group
      ${active ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'}
    `}
  >
    <div className={`w-full aspect-[4/3] rounded-2xl mb-4 ${preview} overflow-hidden relative border border-white/5`}>
      <div className="absolute top-2 left-2 w-8 h-1.5 bg-primary/40 rounded-full"></div>
      <div className="absolute top-5 left-2 w-12 h-1 bg-white/10 rounded-full"></div>
      <div className="absolute bottom-2 right-2 w-4 h-4 bg-primary/60 rounded-lg"></div>
    </div>
    <div className="flex items-center justify-between">
      <span className={`font-semibold ${active ? 'text-primary' : 'text-white'}`}>{label}</span>
      {active && (
        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <FiCheck className="text-white w-3 h-3" />
        </div>
      )}
    </div>
  </button>
);

const ToggleSetting = ({ label, description, enabled, onToggle, icon }) => (
  <div className="flex items-center justify-between p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group gap-4">
    <div className="flex items-center gap-3 sm:gap-5">
      {icon && <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-xl shrink-0">{icon}</div>}
      <div className="min-w-0">
        <h4 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors text-sm sm:text-base">{label}</h4>
        <p className="text-xs sm:text-sm text-secondary font-light max-w-md line-clamp-2">{description}</p>
      </div>
    </div>
    <button 
      onClick={() => onToggle(!enabled)}
      className={`
        relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none
        ${enabled ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-white/10'}
      `}
    >
      <div className={`
        absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 shadow-sm
        ${enabled ? 'left-7' : 'left-1'}
      `}></div>
    </button>
  </div>
);

export default Settings;
