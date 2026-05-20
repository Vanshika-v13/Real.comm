import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiLogIn,
  FiSettings,
  FiActivity,
  FiVideo,
  FiUsers,
  FiClock,
  FiUser,
  FiShare2,
  FiUserCheck,
  FiXCircle,
  FiChevronRight,
  FiMenu
} from 'react-icons/fi';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { getAvatarUrl } from '../utils/avatar';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomId';
import { resolveRoomDisplayName } from '../utils/recentRoomsStorage';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const {
    joinRoom,
    joinRequests,
    setJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    error: roomContextError
  } = useRoom();

  // Component States
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activities, setActivities] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Quick Join Form States
  const [joinCode, setJoinCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const quickJoinInputRef = useRef(null);

  // Greeting by hour
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Helper for relative timestamps
  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Just now';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Fetch recent meetings details from backend using local keys
  const fetchRecentRooms = useCallback(async () => {
    if (!user) return;
    setLoadingRooms(true);

    const key = `real_comm_recent_rooms_${user.id || user._id}`;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(key) || '[]');
      console.log('[VERIFY-NAME] rooms in storage:',
        saved.map(r => ({
          id: r.roomId || (typeof r === 'string' ? r : null),
          name: r.roomName,
          role: r.role
        }))
      );
    } catch (e) {
      console.error('Error parsing recent rooms from localStorage:', e);
      saved = [];
    }

    if (!Array.isArray(saved)) {
      saved = [];
    }

    // 1. Normalize entries and remove invalid ones safely, merging duplicates
    const normalizedMap = new Map();
    saved.forEach(entry => {
      if (!entry) return;
      let rId, jAt, hName, uRole, act, rName;

      if (typeof entry === 'string') {
        rId = entry;
        jAt = new Date().toISOString();
        hName = 'Meeting';
        uRole = 'Participant';
        act = false;
        rName = 'Meeting Room';
      } else if (typeof entry === 'object' && entry.roomId) {
        rId = entry.roomId;
        jAt = entry.joinedAt || new Date().toISOString();
        hName = entry.hostName || 'Meeting';
        uRole = entry.role || 'Participant';
        act = entry.isActive ?? false;
        rName = entry.roomName || 'Meeting Room';
      }

      if (rId) {
        const cleanId = rId.trim().toUpperCase();
        if (!normalizedMap.has(cleanId)) {
          normalizedMap.set(cleanId, {
            roomId: cleanId,
            joinedAt: jAt,
            hostName: hName,
            role: uRole,
            roomName: rName,
            isActive: act
          });
        }
      }
    });

    const normalized = Array.from(normalizedMap.values());

    // 2. Filter to last 15 days
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const last15Days = normalized.filter(entry => {
      const joinDate = new Date(entry.joinedAt);
      return joinDate >= fifteenDaysAgo;
    });

    if (last15Days.length === 0) {
      setRooms([]);
      setLoadingRooms(false);
      try {
        localStorage.setItem(key, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      return;
    }

    try {
      const roomDetails = [];
      const updatedCodes = [];

      for (const entry of last15Days) {
        try {
          const response = await api.get(`/rooms/${entry.roomId}`);
          if (response.data?.status === 'success' && response.data?.data?.room) {
            const fetchedRoom = response.data.data.room;
            const isHost = fetchedRoom.createdBy?.id === user.id || fetchedRoom.createdBy?._id === user._id || fetchedRoom.createdBy === user.id || fetchedRoom.createdBy === user._id;
            const isRoomActive = fetchedRoom.isActive || false;
            const role = entry.role || (isHost ? 'host' : 'joiner');
            const displayName = resolveRoomDisplayName(fetchedRoom, entry.roomName);
            roomDetails.push({
              ...fetchedRoom,
              joinedAt: entry.joinedAt,
              isActive: isRoomActive,
              userRole: isHost ? 'Host' : 'Participant',
              role: role,
              roomName: displayName,
              cachedRoomName: entry.roomName || entry.hostName || displayName,
              exists: true
            });
            updatedCodes.push({
              ...entry,
              isActive: isRoomActive,
              roomName: displayName,
              role: role
            });
          }
        } catch (err) {
          if (err.response?.status === 404) {
            // Room deleted/expired: show under ended, disable rejoin
            const role = entry.role || 'joiner';
            roomDetails.push({
              roomId: entry.roomId,
              createdAt: entry.joinedAt,
              joinedAt: entry.joinedAt,
              createdBy: {
                fullName: entry.hostName || 'Expired Meeting',
                name: entry.hostName || 'Expired Meeting'
              },
              participants: [],
              isActive: false,
              userRole: role === 'host' ? 'Host' : 'Participant',
              role: role,
              roomName: resolveRoomDisplayName(null, entry.roomName || entry.hostName),
              cachedRoomName: entry.roomName || entry.hostName || 'Meeting Room',
              exists: false
            });
            updatedCodes.push({ ...entry, isActive: false, role: role });
          } else {
            // Network/other issue: keep the entry as is
            updatedCodes.push(entry);
          }
        }
      }

      // Sync active/expired codes back to localStorage
      localStorage.setItem(key, JSON.stringify(updatedCodes));
      setRooms(roomDetails);
    } catch (err) {
      console.error('Error fetching recent rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [user]);

  // Load activities feed
  const loadActivities = useCallback(() => {
    if (!user) return;
    const key = `real_comm_activity_feed_${user.id || user._id}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    setActivities(saved);
  }, [user]);

  useEffect(() => {
    fetchRecentRooms();
    loadActivities();

    const handleActivityUpdate = () => {
      loadActivities();
    };

    window.addEventListener('real_comm_activity_updated', handleActivityUpdate);
    return () => {
      window.removeEventListener('real_comm_activity_updated', handleActivityUpdate);
    };
  }, [fetchRecentRooms, loadActivities]);

  // Lightweight interval validation ONLY for active rooms
  useEffect(() => {
    const activeRooms = rooms.filter(r => r.isActive && r.exists);
    if (activeRooms.length === 0) return;

    const intervalId = setInterval(async () => {
      let changed = false;
      const updatedRooms = [...rooms];

      for (let i = 0; i < updatedRooms.length; i++) {
        const room = updatedRooms[i];
        if (room.isActive && room.exists) {
          try {
            const response = await api.get(`/rooms/${room.roomId}`);
            const isActiveNow = response.data?.data?.room?.isActive || false;

            if (!isActiveNow) {
              updatedRooms[i] = { ...room, isActive: false };
              changed = true;

              // Safely sync downgraded status to localStorage
              if (user) {
                const key = `real_comm_recent_rooms_${user.id || user._id}`;
                try {
                  const saved = JSON.parse(localStorage.getItem(key) || '[]');
                  const updatedCache = saved.map(r => {
                    const entry = typeof r === 'string' ? { roomId: r } : r;
                    if (entry.roomId === room.roomId) {
                      return { ...entry, isActive: false };
                    }
                    return entry;
                  });
                  localStorage.setItem(key, JSON.stringify(updatedCache));
                } catch (e) { }
              }
            }
          } catch (err) {
            if (err.response?.status === 404) {
              updatedRooms[i] = { ...room, isActive: false, exists: false };
              changed = true;

              // Safely sync downgraded status to localStorage
              if (user) {
                const key = `real_comm_recent_rooms_${user.id || user._id}`;
                try {
                  const saved = JSON.parse(localStorage.getItem(key) || '[]');
                  const updatedCache = saved.map(r => {
                    const entry = typeof r === 'string' ? { roomId: r } : r;
                    if (entry.roomId === room.roomId) {
                      return { ...entry, isActive: false };
                    }
                    return entry;
                  });
                  localStorage.setItem(key, JSON.stringify(updatedCache));
                } catch (e) { }
              }

            }
          }
        }
      }

      if (changed) {
        setRooms(updatedRooms);
      }
    }, 3000); // 3s interval

    return () => clearInterval(intervalId);
  }, [rooms, user]);

  // Handle Quick Join Card
  const handleQuickJoinSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    let codeInput = joinCode.trim();

    // Parse invite link structure
    if (codeInput.includes('http://') || codeInput.includes('https://') || codeInput.includes('/room/')) {
      const parts = codeInput.split('/room/');
      if (parts.length > 1) {
        codeInput = parts[1].split('?')[0];
      }
    }

    const normalized = normalizeRoomCode(codeInput);
    if (!isValidRoomCode(normalized)) {
      setLocalError('Invalid room code format. Expected: ABCD-1234');
      return;
    }

    setJoinLoading(true);
    navigate(`/room/${normalized}`);
    setJoinLoading(false);
  };

  // Pending join requests received via socket
  const allPendingRequests = useMemo(() => {
    return [...joinRequests].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }, [joinRequests]);

  const { activeMeetings, recentMeetings } = useMemo(() => {
    const active = [];
    const recent = [];

    rooms.forEach(room => {
      // Rejoin button rule: exists === true AND room isActive is true
      if (room.isActive && room.exists) {
        active.push(room);
      } else {
        recent.push(room);
      }
    });

    // Sort by joinedAt descending
    active.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
    recent.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

    return { activeMeetings: active, recentMeetings: recent };
  }, [rooms]);

  // Approve & Reject Action Handlers
  const handleApproveRequest = async (roomId, userId, socketId) => {
    await approveJoinRequest(roomId, userId, socketId);
  };

  const handleRejectRequest = async (roomId, userId, socketId) => {
    await rejectJoinRequest(roomId, userId, socketId, 'Request rejected by host');
  };

  const handleRejoinRoom = async (roomId) => {
    setLocalError('');
    await joinRoom(roomId);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />

      <main className="flex-1 ml-0 md:ml-64 p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto w-full overflow-x-hidden">
        {/* Hero Section */}
        <section className="mb-6 md:mb-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-[2rem] p-6 md:p-8 border border-white/5 bg-gradient-to-br from-primary/10 via-card to-background flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
          >
            <div className="flex items-center gap-3 sm:gap-5 lg:gap-6 w-full lg:w-auto">
              <button 
                className="md:hidden p-2 bg-white/5 rounded-xl text-white hover:bg-white/10"
                onClick={() => setSidebarOpen(true)}
              >
                <FiMenu size={24} />
              </button>
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary to-accent p-0.5 shadow-xl shrink-0">
                <div className="w-full h-full rounded-[0.9rem] bg-slate-950 flex items-center justify-center overflow-hidden">
                  {user?.profileImage ? (
                    <img src={getAvatarUrl(user.profileImage)} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-2xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-primary text-xs font-semibold uppercase tracking-widest">{getGreeting()}</span>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight mt-0.5">
                  {user?.fullName || user?.name}
                </h1>
                <p className="text-secondary font-light text-xs mt-0.5">
                  {user?.username ? `@${user.username}` : user?.email}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
              <Button
                onClick={() => navigate('/meetings')}
                className="rounded-xl px-5 h-11 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FiPlus /> Start Meeting
              </Button>
              <Button
                onClick={() => navigate('/meetings')}
                variant="outline"
                className="rounded-xl px-5 h-11 hover:bg-white/5 border-white/10 text-white flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FiLogIn /> Join Meeting
              </Button>
            </div>
          </motion.div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Main Content Area */}
          <div className="md:col-span-12 lg:col-span-8 space-y-6 sm:space-y-8">

            {/* My Meetings Section */}
            <section>
              <h2 className="text-xs font-bold text-secondary uppercase tracking-[0.2em] mb-4">My Meetings</h2>

              {loadingRooms ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-28 bg-white/5 rounded-3xl animate-pulse border border-white/5"></div>
                  ))}
                </div>
              ) : (activeMeetings.length > 0 || recentMeetings.length > 0) ? (
                <div className="space-y-6">
                  {/* Active Meetings Group */}
                  {activeMeetings.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active Meetings
                      </h3>
                      <div className="space-y-3">
                        {activeMeetings.map((room, idx) => (
                          <motion.div
                            key={room.roomId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass-panel rounded-2xl p-4 border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-card to-background hover:border-emerald-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 relative">
                                {room.createdBy?.profileImage && room.exists ? (
                                  <img src={getAvatarUrl(room.createdBy.profileImage)} alt={room.createdBy?.fullName} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <FiVideo className="text-lg" />
                                )}
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-slate-950 animate-pulse" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-white font-medium text-sm">
                                    {room.roomName || room.cachedRoomName || 'Meeting Room'}
                                  </h4>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${room.userRole === 'Host'
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-white/5 text-secondary border border-white/10'
                                    }`}>
                                    {room.userRole}
                                  </span>
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                                    Active
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-secondary mt-1 font-light flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <FiClock className="text-[10px]" /> Joined {formatRelativeTime(room.joinedAt)}
                                  </span>
                                  {room.exists && (
                                    <span className="flex items-center gap-1">
                                      <FiUsers className="text-[10px]" /> {room.participants?.length || 1} participant{room.participants?.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase font-mono text-secondary/40 bg-white/5 px-2 py-0.5 rounded">
                                    ID: {room.roomId}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center">
                              {room.isActive && room.exists && (
                                <Button
                                  onClick={() => handleRejoinRoom(room.roomId)}
                                  className="rounded-xl h-9 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10 flex items-center gap-2"
                                >
                                  <FiLogIn /> Rejoin Room
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Meetings Group */}
                  {recentMeetings.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-2 mb-3">
                        Recent Meetings (Last 15 Days)
                      </h3>
                      <div className="space-y-2">
                        {recentMeetings.map((room, idx) => (
                          <motion.div
                            key={room.roomId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 0.8 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass-panel rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white/5 text-secondary flex items-center justify-center shrink-0">
                                {room.createdBy?.profileImage && room.exists ? (
                                  <img src={getAvatarUrl(room.createdBy.profileImage)} alt={room.createdBy?.fullName} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <FiVideo className="text-lg" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-white/80 font-medium text-sm">
                                    {room.roomName || room.cachedRoomName || 'Meeting Room'}
                                  </h4>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${room.userRole === 'Host'
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-white/5 text-secondary border border-white/10'
                                    }`}>
                                    {room.userRole}
                                  </span>
                                  <span className="text-[9px] bg-white/5 text-secondary/60 border border-white/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    Ended
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-secondary mt-1 font-light flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <FiClock className="text-[10px]" /> {room.userRole === 'Host' ? 'Hosted' : 'Joined'} {formatRelativeTime(room.joinedAt)}
                                  </span>
                                  {room.exists && (
                                    <span className="flex items-center gap-1">
                                      <FiUsers className="text-[10px]" /> {room.participants?.length || 1} participant{room.participants?.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase font-mono text-secondary/40 bg-white/5 px-2 py-0.5 rounded">
                                    ID: {room.roomId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-panel border-dashed border-2 border-white/5 rounded-[2rem] p-10 text-center flex flex-col items-center justify-center min-h-[200px]"
                >
                  <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-secondary/60 mb-4">
                    <FiVideo className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">
                    You haven’t joined or hosted any recent meetings.
                  </h3>
                  <p className="text-secondary/60 max-w-sm mx-auto mb-5 font-light text-xs">
                    Create or join a room to get started.
                  </p>
                  <Button onClick={() => navigate('/meetings')} className="px-5 h-9 rounded-xl text-xs">
                    Start a Meeting
                  </Button>
                </motion.div>
              )}
            </section>

            {/* Pending Join Requests (Host approvals) */}
            {allPendingRequests.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span> Pending Join Requests
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {allPendingRequests.map((req) => (
                      <motion.div
                        key={req.socketId}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-panel rounded-2xl p-4 border border-white/10 flex items-start justify-between gap-4"
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {req.user?.profileImage ? (
                              <img src={getAvatarUrl(req.user.profileImage)} alt={req.user?.fullName} className="w-full h-full object-cover" />
                            ) : (
                              req.user?.name?.charAt(0) || 'G'
                            )}
                          </div>
                          <div>
                            <h4 className="text-white font-semibold text-xs">{req.user?.fullName || req.user?.name}</h4>
                            <p className="text-secondary text-[10px] mt-0.5">@{req.user?.username || 'guest'}</p>
                            <span className="inline-block text-[9px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-2">
                              Room: {req.roomId}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleApproveRequest(req.roomId, req.userId, req.socketId)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-[10px] font-bold"
                          >
                            <FiUserCheck size={13} /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.roomId, req.userId, req.socketId)}
                            className="p-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors flex items-center justify-center gap-1.5 text-[10px] font-bold"
                          >
                            <FiXCircle size={13} /> Reject
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar Columns */}
          <div className="md:col-span-12 lg:col-span-4 space-y-6 sm:space-y-8">

            {/* Profile Summary Card */}
            <section className="glass-panel rounded-[2rem] p-6 border-white/10 relative overflow-hidden bg-gradient-to-br from-card to-background">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent p-0.5 shadow-md mb-3">
                  <div className="w-full h-full rounded-[0.9rem] bg-slate-950 flex items-center justify-center overflow-hidden">
                    {user?.profileImage ? (
                      <img src={getAvatarUrl(user.profileImage)} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                </div>

                <h3 className="text-white font-bold text-sm">{user?.fullName || user?.name}</h3>
                <span className="text-secondary text-[11px] font-light mt-0.5">@{user?.username || 'username'}</span>

                {user?.bio && (
                  <p className="text-secondary font-light text-[11px] mt-3 px-2 border-t border-white/5 pt-3 leading-relaxed">
                    {user.bio}
                  </p>
                )}

                <div className="w-full border-t border-white/5 mt-4 pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-secondary font-medium">Theme Setting</span>
                  <span className="text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                    {theme} Mode
                  </span>
                </div>
              </div>
            </section>

            {/* Quick Join Card */}
            <section className="glass-panel rounded-[2rem] p-6 border-white/10">
              <h3 className="text-white font-bold tracking-tight mb-3 text-xs flex items-center gap-2 uppercase tracking-widest text-secondary">
                Quick Join Meeting
              </h3>

              {(roomContextError || localError) && (
                <div className="bg-accent/10 border border-accent/20 text-accent px-3 py-2 rounded-xl text-[11px] mb-3 leading-snug">
                  {roomContextError || localError}
                </div>
              )}

              <form onSubmit={handleQuickJoinSubmit} className="space-y-3">
                <input
                  ref={quickJoinInputRef}
                  type="text"
                  placeholder="Enter Room Code or Paste Invite URL"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-light text-white"
                  required
                />
                <Button
                  type="submit"
                  isLoading={joinLoading}
                  className="w-full rounded-xl h-10 text-xs font-bold"
                >
                  Join via Code
                </Button>
              </form>
            </section>

            {/* Live Activity Feed */}
            <section className="glass-panel rounded-[2rem] p-6 border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <FiActivity className="text-primary" /> Live Activity Feed
              </h3>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {activities.length > 0 ? (
                    activities.map((act) => (
                      <motion.div
                        key={act.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-start gap-3 p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                          {act.userAvatar ? (
                            <img src={getAvatarUrl(act.userAvatar)} alt={act.userName} className="w-full h-full object-cover" />
                          ) : (
                            act.userName?.charAt(0) || 'U'
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-[11px]">
                          <p className="text-white font-medium truncate">
                            {act.userName}
                          </p>
                          <p className="text-secondary font-light mt-0.5 leading-normal">
                            {act.action}
                            {act.roomName && <span className="text-primary font-medium"> ({act.roomName})</span>}
                            {act.fileName && <span className="text-emerald-400 font-medium"> ({act.fileName})</span>}
                          </p>
                          <span className="text-[9px] text-secondary/40 font-semibold block mt-1 uppercase tracking-wider">
                            {formatRelativeTime(act.timestamp)}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-secondary/50 text-xs font-light">
                      No events logged in this session yet. Join a room or collaborate to see activity.
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
