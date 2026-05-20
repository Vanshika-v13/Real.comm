import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiMessageSquare, FiX, FiSend } from 'react-icons/fi';
import { getAvatarUrl } from '../utils/avatar';

const ChatPanel = ({ messages = [], onSendMessage, onClose, currentUserId }) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-80 bg-slate-950 border-l border-white/5 z-[60] flex flex-col shadow-2xl"
    >
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <FiMessageSquare className="text-primary" />
          <span className="font-semibold">Chat</span>
        </div>
        <button type="button" onClick={onClose} className="p-2 text-secondary hover:text-white rounded-lg hover:bg-white/5">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.sender?.userId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}
            >
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-white font-bold text-[10px] overflow-hidden shrink-0 mt-1">
                  {msg.sender?.profileImage ? (
                    <img src={getAvatarUrl(msg.sender.profileImage)} alt={msg.sender?.name} className="w-full h-full object-cover" />
                  ) : (
                    msg.sender?.name?.charAt(0) || 'U'
                  )}
                </div>
              )}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-secondary mb-1">
                  {isMe ? 'You' : msg.sender?.name} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm break-words leading-relaxed ${
                    isMe
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-white/5 text-white border border-white/5 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-30">
            <FiMessageSquare className="w-10 h-10 text-primary mb-3" />
            <p className="text-sm text-secondary">No messages yet. Send a message to start chatting!</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-slate-950 shrink-0 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-secondary focus:outline-none focus:border-primary/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </form>
    </motion.div>
  );
};

export default ChatPanel;
