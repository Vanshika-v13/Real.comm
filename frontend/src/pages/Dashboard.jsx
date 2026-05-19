import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { motion } from 'framer-motion';
import { FiPlus, FiSearch, FiBell, FiPlusCircle, FiTrendingUp, FiActivity } from 'react-icons/fi';
import Button from '../components/Button';

const Dashboard = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10">
        {/* Top Header */}
        <header className="flex justify-between items-center mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Welcome back!</h1>
            <p className="text-secondary font-light">Here's a summary of your workspace activity.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-5"
          >
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all w-80 font-light"
              />
            </div>
            <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-secondary hover:text-white hover:bg-white/10 transition-all relative group">
              <FiBell className="group-hover:rotate-12 transition-transform" />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-accent rounded-full border-2 border-background"></span>
            </button>
            <Button type="button" className="rounded-2xl px-8 h-12 shadow-lg shadow-primary/20" onClick={() => navigate('/join')}>
              <FiPlus className="mr-2" /> New Project
            </Button>
          </motion.div>
        </header>

        {/* Dashboard Content */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-12 gap-10"
        >
          {/* Main Area - Empty State Example */}
          <section className="col-span-8">
            <motion.div 
              variants={itemVariants}
              className="glass-panel rounded-[2.5rem] p-16 text-center flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-white/10 group hover:border-primary/30 transition-colors"
            >
              <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <FiPlusCircle className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">No active conversations</h2>
              <p className="text-secondary max-w-md mx-auto mb-10 leading-relaxed font-light text-lg">
                Your workspace is a bit quiet. Start a new conversation or join a channel to begin collaborating.
              </p>
              <Button type="button" variant="outline" className="px-10 h-14 rounded-2xl text-lg hover:bg-white/5" onClick={() => navigate('/join')}>
                Create your first channel
              </Button>
            </motion.div>
          </section>

          {/* Sidebar Area */}
          <section className="col-span-4 space-y-8">
            <motion.div variants={itemVariants} className="glass-panel rounded-[2rem] p-8 border-white/10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Recent Activity</h3>
                <FiActivity className="text-primary" />
              </div>
              <div className="space-y-6">
                <ActivityItem 
                  user="Sarah Chen" 
                  action="joined the team" 
                  time="2h ago" 
                  color="bg-primary shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                />
                <ActivityItem 
                  user="Product Sync" 
                  action="was scheduled" 
                  time="4h ago" 
                  color="bg-accent shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                />
                <ActivityItem 
                  user="Dev Channel" 
                  action="new message" 
                  time="5h ago" 
                  color="bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                />
              </div>
              <button className="w-full mt-8 py-3 text-xs font-bold text-secondary hover:text-white transition-colors border-t border-white/5 pt-6">
                View All Activity
              </button>
            </motion.div>

            <motion.div 
              variants={itemVariants}
              className="glass-panel rounded-[2rem] p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 relative overflow-hidden group"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FiTrendingUp className="text-primary text-xs" />
                </div>
                <h3 className="text-white font-bold tracking-tight">Workspace Tip</h3>
              </div>
              <p className="text-sm text-secondary leading-relaxed font-light">
                Use <span className="text-white font-medium">Channels</span> to organize conversations by project or department for better focus.
              </p>
            </motion.div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};

const ActivityItem = ({ user, action, time, color }) => (
  <div className="flex items-center gap-4 group cursor-pointer">
    <div className={`w-2.5 h-2.5 rounded-full ${color} transition-transform group-hover:scale-150`}></div>
    <div className="flex-1 text-sm">
      <span className="text-white font-semibold group-hover:text-primary transition-colors">{user}</span>
      <span className="text-secondary font-light"> {action}</span>
    </div>
    <span className="text-[10px] font-bold text-secondary/40 uppercase tracking-wider">{time}</span>
  </div>
);

export default Dashboard;

