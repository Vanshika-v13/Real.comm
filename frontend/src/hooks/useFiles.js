import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import socketService from '../services/socketService';

export const useFiles = (roomId) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(() => socketService.getSocket());

  useEffect(() => {
    return socketService.subscribe((sock) => setSocket(sock));
  }, []);

  const fetchFiles = useCallback(async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/rooms/${roomId}/files`);
      if (response.data.status === 'success') {
        setFiles(response.data.data.files);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const uploadFile = async (file) => {
    if (!roomId || !file) return;
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/rooms/${roomId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.status === 'success') {
        const uploaded = response.data.data.file;
        if (uploaded) {
          setFiles((prev) => {
            const id = uploaded.id || uploaded._id;
            if (prev.some((f) => (f.id || f._id) === id)) return prev;
            return [uploaded, ...prev];
          });
        }
        return uploaded;
      }
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const downloadFile = async (fileId) => {
    const response = await api.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  };

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const handleFileShared = ({ file }) => {
      if (!file) return;
      setFiles((prev) => {
        const id = file.id || file._id;
        if (prev.some((f) => (f.id || f._id) === id)) return prev;
        return [file, ...prev];
      });
    };

    socket.on('file-shared', handleFileShared);
    return () => socket.off('file-shared', handleFileShared);
  }, [roomId, socket]);

  return {
    files,
    isUploading,
    uploadProgress,
    isLoading,
    uploadFile,
    downloadFile,
  };
};
