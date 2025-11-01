import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Send, Image as ImageIcon, Mic, Paperclip, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TaskComments = ({ taskId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    try {
      const response = await api.get(`/tasks/${taskId}/comments`);
      setComments(response.data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/uploads/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachments([...attachments, ...response.data.files]);
      toast.success(`${files.length} Datei(en) hochgeladen`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fehler beim Hochladen');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && attachments.length === 0) return;

    try {
      setLoading(true);
      const data = {
        text: newComment,
        attachments: attachments.map(a => a.path)
      };

      await api.post(`/tasks/${taskId}/comments`, data);
      setNewComment('');
      setAttachments([]);
      loadComments();
      toast.success('Kommentar hinzugefugt');
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.map(comment => (
          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {comment.user_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{comment.user_name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleString('de-DE')}
                </p>
              </div>
            </div>
            <p className="text-gray-800 text-sm">{comment.text}</p>

            {/* Attachments */}
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {comment.attachments.map((att, idx) => {
                  const isImage = att.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                  const isAudio = att.match(/\.(mp3|wav|ogg|m4a)$/i);

                  if (isImage) {
                    return (
                      <img
                        key={idx}
                        src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${att}`}
                        alt="attachment"
                        className="h-20 rounded-lg border-2 border-gray-300 cursor-pointer hover:opacity-80"
                        onClick={() => window.open(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${att}`, '_blank')}
                      />
                    );
                  } else if (isAudio) {
                    return (
                      <audio
                        key={idx}
                        controls
                        className="h-10"
                        src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${att}`}
                      />
                    );
                  } else {
                    return (
                      <a
                        key={idx}
                        href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${att}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                      >
                        <Paperclip className="w-4 h-4 inline mr-1" />
                        Datei
                      </a>
                    );
                  }
                })}
              </div>
            )}
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-center text-gray-500 py-8">Keine Kommentare</p>
        )}
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="border-t pt-4">
        <div className="mb-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Kommentar schreiben..."
            rows="3"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative inline-block">
                {file.mimetype?.startsWith('image/') && (
                  <img
                    src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${file.path}`}
                    alt="preview"
                    className="h-20 rounded-lg border-2 border-gray-300"
                  />
                )}
                {file.mimetype?.startsWith('audio/') && (
                  <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    {file.originalname}
                  </div>
                )}
                {!file.mimetype?.startsWith('image/') && !file.mimetype?.startsWith('audio/') && (
                  <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    {file.originalname}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            multiple
            accept="image/*,audio/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="comment-file-upload"
          />
          <label
            htmlFor="comment-file-upload"
            className="px-3 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" />
            Anhangen
          </label>

          <button
            type="submit"
            disabled={loading || (!newComment.trim() && attachments.length === 0)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Senden
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskComments;
