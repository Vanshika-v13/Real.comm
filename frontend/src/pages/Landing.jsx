import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiMessageSquare, FiVideo, FiShield, FiZap, FiArrowRight, 
  FiLock, FiCheckCircle, FiServer, FiActivity 
} from 'react-icons/fi';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const Landing = () => {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">R</span>
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Real.Comm</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-secondary">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Button variant="ghost" onClick={logout} className="hidden sm:flex">Log out</Button>
                  <Link to="/dashboard">
                    <Button className="shadow-lg shadow-primary/20">Collaborate Now</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button className="shadow-lg shadow-primary/20 hidden sm:flex">Log in</Button>
                  </Link>
                  <Link to="/register">
                    <Button className="shadow-lg shadow-primary/20">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 opacity-50"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary text-xs font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              v2.0 is now live with Secure Communication
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-white tracking-tight mb-8 leading-[1.05]">
              Communication for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-pulse-slow">modern teams.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-secondary max-w-2xl mx-auto mb-12 leading-relaxed font-light px-4">
              Experience lightning-fast real-time messaging and seamless collaboration. 
              Built for speed, security, and the way modern teams actually work.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-xs sm:max-w-none mx-auto px-4">
              {user ? (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button className="w-full h-14 px-10 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] sm:hover:scale-105 transition-transform flex items-center justify-center">
                    Open Workspace <FiArrowRight className="ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link to="/register" className="w-full sm:w-auto">
                  <Button className="w-full h-14 px-10 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] sm:hover:scale-105 transition-transform flex items-center justify-center">
                    Start Collaborating <FiArrowRight className="ml-2" />
                  </Button>
                </Link>
              )}
              <Link to="/demo" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full h-14 px-10 text-lg rounded-2xl hover:bg-white/5 flex items-center justify-center">
                  View demo
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* App Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="mt-16 sm:mt-24 px-2"
          >
            <div className="glass-panel rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-2xl border-white/10 mx-auto max-w-5xl aspect-video relative group ring-1 ring-white/10 p-2 sm:p-4">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none"></div>
              <div className="w-full h-full bg-slate-950 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col">
                <div className="h-10 sm:h-12 border-b border-white/5 flex items-center px-4 sm:px-6 gap-2 bg-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/20"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/20"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/20"></div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-12 gap-3 sm:gap-4 p-3 sm:p-4 opacity-50">
                  <div className="col-span-2 sm:col-span-1 bg-white/5 rounded-lg sm:rounded-xl"></div>
                  <div className="col-span-3 bg-white/5 rounded-lg sm:rounded-xl hidden sm:block"></div>
                  <div className="col-span-10 sm:col-span-8 space-y-3 sm:space-y-4">
                    <div className="w-1/3 h-6 sm:h-8 bg-white/10 rounded-lg"></div>
                    <div className="w-2/3 h-12 sm:h-16 bg-primary/10 rounded-xl sm:rounded-2xl self-end ml-auto"></div>
                    <div className="w-1/2 h-12 sm:h-16 bg-white/5 rounded-xl sm:rounded-2xl"></div>
                    <div className="w-3/4 h-12 sm:h-16 bg-primary/10 rounded-xl sm:rounded-2xl self-end ml-auto"></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="py-20 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything you need</h2>
            <p className="text-secondary max-w-xl mx-auto text-sm sm:text-base">Powerful features designed to help your team perform at its best without the friction.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard 
              icon={<FiZap className="text-primary w-6 h-6" />}
              title="Instant Messaging"
              description="Zero latency messaging with real-time delivery status and read receipts."
              delay={0.1}
            />
            <FeatureCard 
              icon={<FiShield className="text-primary w-6 h-6" />}
              title="Reliable Security"
              description="Secure communication and advanced access controls for your peace of mind."
              delay={0.2}
            />
            <FeatureCard 
              icon={<FiVideo className="text-primary w-6 h-6" />}
              title="HD Communication"
              description="Crystal clear voice and video calls with adaptive bitrate streaming."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section id="security" className="py-20 sm:py-32 bg-slate-950/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 sm:mb-8 leading-tight">
                Security & Privacy <br />
                <span className="text-primary">for your workspace.</span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-secondary mb-8 sm:mb-10 leading-relaxed font-light">
                Your protection is our priority. We implement robust security protocols to 
                ensure your data and conversations remain private and secure at all times.
              </p>
              <div className="flex items-center gap-4 text-secondary/50 text-xs sm:text-sm">
                <FiCheckCircle className="text-primary" />
                <span>Technically accurate security implementation</span>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative">
              <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10"></div>
              
              <SecurityCard 
                icon={<FiLock />}
                title="Secure Authentication"
                desc="JWT-based sessions with industry-standard hashing to protect your credentials."
                delay={0.1}
              />
              <SecurityCard 
                icon={<FiShield />}
                title="Protected Communication"
                desc="Real-time socket connections and WebRTC media streams handled with best practices."
                delay={0.2}
              />
              <SecurityCard 
                icon={<FiActivity />}
                title="Real-Time Stability"
                desc="Active connection monitoring ensuring reliable and secure peer-to-peer delivery."
                delay={0.3}
              />
              <SecurityCard 
                icon={<FiCheckCircle />}
                title="Privacy Focused"
                desc="Architecture designed to minimize data exposure and prioritize user privacy."
                delay={0.4}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.07] transition-all group cursor-default"
  >
    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
      {React.cloneElement(icon, { className: "text-primary w-7 h-7" })}
    </div>
    <h3 className="text-2xl font-semibold text-white mb-4">{title}</h3>
    <p className="text-secondary leading-relaxed font-light">{description}</p>
  </motion.div>
);

const SecurityCard = ({ icon, title, desc, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="glass-panel p-6 rounded-3xl border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden"
  >
    <div className="absolute -right-2 -top-2 w-12 h-12 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/20 transition-colors"></div>
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
      {React.cloneElement(icon, { className: "text-primary w-6 h-6" })}
    </div>
    <h4 className="text-white font-semibold mb-2">{title}</h4>
    <p className="text-secondary text-xs leading-relaxed font-light">{desc}</p>
  </motion.div>
);

export default Landing;

