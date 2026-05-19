import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFile, FiDownload, FiUploadCloud, FiX, FiFolder, FiFileText, FiImage, FiMusic, FiVideo } from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';

const getFileIcon = (type) => {
  if (type.includes('image')) return <FiImage className="text-blue-400" />;
  if (type.includes('video')) return <FiVideo className="text-purple-400" />;
  if (type.includes('audio')) return <FiMusic className="text-pink-400" />;
  if (type.includes('pdf') || type.includes('text')) return <FiFileText className="text-emerald-400" />;
  return <FiFile className="text-slate-400" />;
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FilePanel = ({ files, isUploading, uploadProgress, onUpload, onDownload, onClose }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-80 bg-slate-950 border-l border-white/5 z-[60] flex flex-col shadow-2xl"
    >
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-2 text-white">
          <FiFolder className="text-primary" />
          <span className="text-sm font-semibold">Shared Files</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-secondary">{files.length}</span>
        </div>
        <button onClick={onClose} className="p-2 text-secondary hover:text-white transition-colors">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          className={`
            p-6 border-2 border-dashed rounded-2xl mb-6 transition-all cursor-pointer
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-white/5 hover:border-white/20 bg-white/5'}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <FiUploadCloud className={`w-5 h-5 ${isDragActive ? 'text-primary' : 'text-secondary'}`} />
            </div>
            <p className="text-xs font-medium text-white">Drop files to share</p>
            <p className="text-[10px] text-secondary">Max size 50MB</p>
          </div>
        </div>

        {/* Uploading Status */}
        {isUploading && (
          <div className="mb-6 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex justify-between text-[10px] mb-2">
              <span className="text-white font-medium">Uploading file...</span>
              <span className="text-primary">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {files.map((file) => (
              <FileItem key={file.id || file._id} file={file} onDownload={onDownload} />
            ))}
          </AnimatePresence>

          {files.length === 0 && !isUploading && (
            <div className="py-12 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <FiFile className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-xs text-secondary">No files shared yet</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const FileItem = ({ file, onDownload }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="group p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all flex items-center gap-3"
  >
    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-lg">
      {getFileIcon(file.fileType)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-white truncate" title={file.fileName}>{file.fileName}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-secondary">{formatSize(file.fileSize)}</span>
        <span className="w-1 h-1 rounded-full bg-white/10"></span>
        <span className="text-[10px] text-secondary truncate">{file.uploadedBy?.name}</span>
      </div>
    </div>
    <button 
      onClick={() => onDownload(file.id || file._id, file.fileName)}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
    >
      <FiDownload size={14} />
    </button>
  </motion.div>
);

export default FilePanel;
