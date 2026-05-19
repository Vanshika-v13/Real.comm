import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, FiMoon, FiBell, FiLock, FiCamera, 
  FiCheck, FiX, FiLoader, FiTrash2, FiShield,
  FiChevronRight
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import settingsService from '../services/settingsService';

const Settings = () => {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({ name: '', bio: '' });
  const [themePreference, setThemePreference] = useState('dark');
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    meetingAlerts: true,
    soundEnabled: true,
  });
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: true,
    allowRoomInvites: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const response = await settingsService.getMySettings();
      const settings = response.data.settings;
      
      setProfileData({ name: settings.name, bio: settings.bio });
      setThemePreference(settings.themePreference);
      setNotificationSettings(settings.notificationSettings);
      setPrivacySettings(settings.privacySettings);
      
      // Keep auth context in sync
      setUser(prev => ({ ...prev, ...settings }));
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to fetch settings', 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await settingsService.updateProfile(profileData);
      setUser(prev => ({ ...prev, ...response.data.settings }));
      toast('Profile updated successfully', 'success');
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTheme = async (theme) => {
    try {
      setThemePreference(theme);
      const response = await settingsService.updateTheme(theme);
      setUser(prev => ({ ...prev, ...response.data.settings }));
      toast('Theme updated', 'success');
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update theme', 'error');
    }
  };

  const handleUpdateNotifications = async (key, value) => {
    try {
      const updated = { ...notificationSettings, [key]: value };
      setNotificationSettings(updated);
      const response = await settingsService.updateNotifications(updated);
      setUser(prev => ({ ...prev, ...response.data.settings }));
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update notifications', 'error');
      // Revert state on error
      setNotificationSettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleUpdatePrivacy = async (key, value) => {
    try {
      const updated = { ...privacySettings, [key]: value };
      setPrivacySettings(updated);
      const response = await settingsService.updatePrivacy(updated);
      setUser(prev => ({ ...prev, ...response.data.settings }));
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update privacy', 'error');
      // Revert state on error
      setPrivacySettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const response = await settingsService.uploadProfileImage(formData);
      setUser(prev => ({ ...prev, ...response.data.settings }));
      toast('Profile image updated', 'success');
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setUploading(true);
      const response = await settingsService.removeProfileImage();
      setUser(prev => ({ ...prev, ...response.data.settings }));
      toast('Profile image removed', 'success');
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to remove image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <FiUser /> },
    { id: 'appearance', label: 'Appearance', icon: <FiMoon /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'privacy', label: 'Privacy', icon: <FiLock /> },
  ];

  if (fetching) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 ml-64 p-10 flex items-center justify-center">
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
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10 max-w-6xl">
        <header className="mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Settings</h1>
            <p className="text-secondary font-light">Manage your account preferences and workspace configuration.</p>
          </motion.div>
        </header>

        <div className="grid grid-cols-12 gap-10">
          {/* Settings Navigation */}
          <aside className="col-span-3">
            <nav className="space-y-2 sticky top-10">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 group
                    ${activeTab === tab.id 
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' 
                      : 'text-secondary hover:text-white hover:bg-white/5 border border-transparent'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-primary' : ''}`}>
                      {tab.icon}
                    </span>
                    <span className="font-medium">{tab.label}</span>
                  </div>
                  <FiChevronRight className={`transition-transform ${activeTab === tab.id ? 'rotate-90 opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </nav>
          </aside>

          {/* Settings Content */}
          <section className="col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel rounded-[2.5rem] p-10 border-white/5"
              >
                {activeTab === 'profile' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>
                      
                      {/* Avatar Upload */}
                      <div className="flex items-center gap-8 mb-10 p-6 bg-white/5 rounded-3xl border border-white/5">
                        <div className="relative group">
                          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-2xl">
                            {user?.profileImage ? (
                              <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
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
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                          </label>
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="text-white font-semibold mb-1">Profile Photo</h3>
                          <p className="text-sm text-secondary mb-4 font-light">Recommended: Square image, at least 400x400px.</p>
                          <div className="flex gap-3">
                            <label className="cursor-pointer px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all">
                              Change Photo
                              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                            </label>
                            {user?.profileImage && (
                              <button 
                                onClick={handleRemoveImage}
                                className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                              >
                                <FiTrash2 size={12} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Profile Form */}
                      <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Full Name</label>
                          <input 
                            type="text" 
                            value={profileData.name}
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light"
                            placeholder="Your name"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-secondary uppercase tracking-wider ml-1">Bio</label>
                          <textarea 
                            value={profileData.bio}
                            onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light min-h-[120px] resize-none"
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

                {activeTab === 'appearance' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6">Appearance</h2>
                      <p className="text-secondary font-light mb-8 leading-relaxed">
                        Customize how the application looks for you. Choose a theme that fits your workspace.
                      </p>

                      <div className="grid grid-cols-3 gap-6">
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
                        <ThemeCard 
                          id="system" 
                          label="System" 
                          active={themePreference === 'system'} 
                          onClick={() => handleUpdateTheme('system')}
                          preview="bg-gradient-to-r from-slate-100 to-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6">Notifications</h2>
                      <p className="text-secondary font-light mb-8 leading-relaxed">
                        Choose what you want to be notified about and how.
                      </p>

                      <div className="space-y-4">
                        <ToggleSetting 
                          label="Email Notifications" 
                          description="Receive updates about your activity and rooms via email."
                          enabled={notificationSettings.emailNotifications}
                          onToggle={(val) => handleUpdateNotifications('emailNotifications', val)}
                        />
                        <ToggleSetting 
                          label="Meeting Alerts" 
                          description="Get notified when a meeting you're invited to starts."
                          enabled={notificationSettings.meetingAlerts}
                          onToggle={(val) => handleUpdateNotifications('meetingAlerts', val)}
                        />
                        <ToggleSetting 
                          label="Sound Effects" 
                          description="Play a sound for incoming messages and alerts."
                          enabled={notificationSettings.soundEnabled}
                          onToggle={(val) => handleUpdateNotifications('soundEnabled', val)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6">Privacy & Security</h2>
                      <p className="text-secondary font-light mb-8 leading-relaxed">
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
  <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
    <div className="flex items-center gap-5">
      {icon && <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl">{icon}</div>}
      <div>
        <h4 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors">{label}</h4>
        <p className="text-sm text-secondary font-light max-w-md">{description}</p>
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
