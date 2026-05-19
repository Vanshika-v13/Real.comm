import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiTrash2, FiDownload, FiX, FiDelete } from 'react-icons/fi';
import socketService from '../services/socketService';
import { mediaLog } from '../utils/mediaLogger';

const COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#ffffff', '#94a3b8',
];

const SIZES = [2, 4, 8, 12];

const Whiteboard = ({ roomId, onClose }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const lastPointRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState('pen');
  const [socket, setSocket] = useState(() => socketService.getSocket());
  const socketRef = useRef(socket);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const existing = socketService.getSocket() || socketService.connect();
    setSocket(existing);
    return socketService.subscribe((nextSocket) => {
      setSocket(nextSocket);
    });
  }, []);

  const logicalWidth = () => window.innerWidth;
  const logicalHeight = () => window.innerHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const w = logicalWidth();
    const h = logicalHeight();
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = size;
    contextRef.current = context;

    return undefined;
  }, []);

  const applyToolToContext = (ctx, strokeTool, strokeColor, strokeSize) => {
    ctx.lineWidth = strokeSize;
    if (strokeTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
    }
  };

  const restoreLocalContext = useCallback((ctx) => {
    applyToolToContext(ctx, tool, color, size);
  }, [tool, color, size]);

  useEffect(() => {
    if (contextRef.current) {
      restoreLocalContext(contextRef.current);
    }
  }, [restoreLocalContext]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    applyToolToContext(ctx, tool, color, size);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    lastPointRef.current = { x: offsetX, y: offsetY };
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    const prev = lastPointRef.current || { x: offsetX, y: offsetY };
    lastPointRef.current = { x: offsetX, y: offsetY };

    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();

    const activeSocket = socketRef.current;
    if (!activeSocket || !roomId) return;

    const stroke = {
      x: offsetX,
      y: offsetY,
      prevX: prev.x,
      prevY: prev.y,
      color,
      size,
      tool,
    };

    activeSocket.emit('whiteboard-draw', { roomId, stroke });
    mediaLog.debug('whiteboard', 'Stroke sent', { tool, size });
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    lastPointRef.current = null;
    restoreLocalContext(contextRef.current);
  };

  const drawRemoteStroke = useCallback(
    (stroke) => {
      const ctx = contextRef.current;
      if (!ctx || !stroke) return;

      const originalComposite = ctx.globalCompositeOperation;
      const originalStrokeStyle = ctx.strokeStyle;
      const originalLineWidth = ctx.lineWidth;

      applyToolToContext(ctx, stroke.tool || 'pen', stroke.color, stroke.size);
      ctx.beginPath();
      ctx.moveTo(stroke.prevX, stroke.prevY);
      ctx.lineTo(stroke.x, stroke.y);
      ctx.stroke();
      ctx.closePath();

      ctx.globalCompositeOperation = originalComposite;
      ctx.strokeStyle = originalStrokeStyle;
      ctx.lineWidth = originalLineWidth;
      restoreLocalContext(ctx);
    },
    [restoreLocalContext],
  );

  useEffect(() => {
    if (!socket) return undefined;

    const handleRemoteDraw = ({ stroke }) => {
      mediaLog.debug('whiteboard', 'Stroke received', { tool: stroke?.tool });
      drawRemoteStroke(stroke);
    };

    const handleRemoteClear = () => {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, logicalWidth(), logicalHeight());
      restoreLocalContext(ctx);
      mediaLog.debug('whiteboard', 'Board cleared remotely');
    };

    socket.on('whiteboard-draw', handleRemoteDraw);
    socket.on('whiteboard-clear', handleRemoteClear);

    return () => {
      socket.off('whiteboard-draw', handleRemoteDraw);
      socket.off('whiteboard-clear', handleRemoteClear);
    };
  }, [socket, drawRemoteStroke, restoreLocalContext]);

  const clearCanvas = () => {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, logicalWidth(), logicalHeight());
    restoreLocalContext(ctx);
    const activeSocket = socketRef.current;
    if (activeSocket && roomId) {
      activeSocket.emit('whiteboard-clear', { roomId });
    }
  };

  const downloadCanvas = () => {
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[60] bg-slate-950 flex flex-col"
    >
      <motion.div className="h-16 px-6 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
        <motion.div className="flex items-center gap-6">
          <motion.div className="flex items-center gap-2">
            <motion.div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white">
              <FiEdit2 size={16} />
            </motion.div>
            <span className="text-sm font-semibold text-white">Collaborative Board</span>
          </motion.div>

          <motion.div className="h-6 w-px bg-white/10 mx-2" />

          <motion.div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-white/5 text-secondary hover:text-white'}`}
              title="Pen"
            >
              <FiEdit2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => setTool('erase')}
              className={`p-2 rounded-xl transition-all ${tool === 'erase' ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-white/5 text-secondary hover:text-white'}`}
              title="Eraser"
            >
              <FiDelete size={16} />
            </button>
          </motion.div>

          <motion.div className="h-6 w-px bg-white/10 mx-2" />

          <motion.div className={`flex items-center gap-2 transition-opacity ${tool === 'erase' ? 'opacity-40 pointer-events-none' : ''}`}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </motion.div>

          <motion.div className="h-6 w-px bg-white/10 mx-2" />

          <motion.div className="flex items-center gap-3">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-full bg-white transition-all ${size === s ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-slate-950' : 'opacity-40 hover:opacity-100'}`}
                style={{ width: s + 4, height: s + 4 }}
              />
            ))}
          </motion.div>
        </motion.div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadCanvas}
            className="p-2.5 rounded-xl bg-white/5 text-secondary hover:text-white hover:bg-white/10 transition-all"
            title="Download"
          >
            <FiDownload />
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="p-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all"
            title="Clear Board"
          >
            <FiTrash2 />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 text-secondary hover:text-white hover:bg-white/10 transition-all"
          >
            <FiX />
          </button>
        </div>
      </motion.div>

      <motion.div className="flex-1 relative overflow-hidden bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px]">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={finishDrawing}
          onMouseLeave={finishDrawing}
          className={`w-full h-full ${tool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'}`}
        />
      </motion.div>

      <motion.div className="absolute bottom-8 right-8 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md text-[10px] text-primary font-bold uppercase tracking-widest pointer-events-none">
        Live Collaboration Active
      </motion.div>
    </motion.div>
  );
};

export default Whiteboard;
