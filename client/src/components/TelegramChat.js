import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUSES = [
  { id: 'online', label: 'Online', icon: '🟢', color: '#4ade80' },
  { id: 'away', label: 'Kurz weg', icon: '🌤️', color: '#facc15' },
  { id: 'busy', label: 'Beschäftigt', icon: '⛔', color: '#f87171' },
  { id: 'dnd', label: 'Bitte nicht stören', icon: '🚫', color: '#ef4444' },
  { id: 'offline', label: 'Offline', icon: '⚪', color: '#94a3b8' }
];

const formatDateHeader = (dateKey) => {
  const today = new Date();
  const parsed = new Date(dateKey);

  const sameDay = format(today, 'yyyy-MM-dd') === dateKey;
  const yesterday = format(addDays(today, -1), 'yyyy-MM-dd') === dateKey;

  if (sameDay) return 'Heute';
  if (yesterday) return 'Gestern';
  return format(parsed, 'dd. MMMM yyyy', { locale: de });
};

const TelegramChat = ({
  users = [],
  messages = [],
  currentUserId,
  onSendMessage,
  onSelectUser,
  selectedUser
}) => {
  const [messageText, setMessageText] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState(STATUSES[0]);
  const [customStatus, setCustomStatus] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const groupedMessages = useMemo(() => {
    const buckets = new Map();

    messages
      .filter((msg) => {
        if (!selectedUser) return true;
        return msg.sender_id === selectedUser.id || msg.receiver_id === selectedUser.id;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach((message) => {
        const key = format(new Date(message.created_at), 'yyyy-MM-dd');
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(message);
      });

    return Array.from(buckets.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  }, [messages, selectedUser]);

  const unreadByUser = useMemo(() => {
    return messages.reduce((acc, message) => {
      if (message.receiver_id === currentUserId && message.read_status === 0) {
        acc[message.sender_id] = (acc[message.sender_id] || 0) + 1;
      }
      return acc;
    }, {});
  }, [messages, currentUserId]);

  const handleSendMessage = (event) => {
    event.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !selectedUser) {
      return;
    }
    onSendMessage(selectedUser.id, trimmed);
    setMessageText('');
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setCustomStatus('');
  };

  const handleStatusSelect = (status) => {
    setActiveStatus(status);
    closeStatusModal();
  };

  const handleCustomStatus = () => {
    if (!customStatus.trim()) return;
    setActiveStatus({ id: 'custom', label: customStatus.trim(), icon: '✨', color: '#818cf8' });
    closeStatusModal();
  };

  return (
    <div className="talkpai-messenger">
      <div className="talkpai-layout">
        <aside className="channel-manager">
          <div className="channel-header">
            <div>
              <h3>Talk pAI Workspace</h3>
              <p className="channel-subtitle">Synchronisiere dich mit deinem Team</p>
            </div>
            <button
              type="button"
              className="create-channel-btn"
              onClick={() => setStatusModalOpen(true)}
            >
              Status setzen
            </button>
          </div>

          <div className="status-preview">
            <span className="status-indicator" style={{ background: activeStatus.color }} />
            <div className="status-copy">
              <span className="status-title">Dein Status</span>
              <span className="status-value">{activeStatus.icon} {activeStatus.label}</span>
            </div>
          </div>

          <div className="channel-categories">
            <div className="category">
              <h4>
                <span className="category-icon">💼</span>
                Direct Channels
+              </h4>
+              <div className="channel-list">
+                {users.map((chatUser) => {
+                  const unread = unreadByUser[chatUser.id] || 0;
+                  const isActive = selectedUser?.id === chatUser.id;
+                  const isMuted = chatUser.role === 'employee' && unread === 0;
+
+                  return (
+                    <button
+                      key={chatUser.id}
+                      type="button"
+                      onClick={() => onSelectUser(chatUser)}
+                      className={`channel-item${isActive ? ' active' : ''}${isMuted ? ' muted' : ''}`}
+                    >
+                      <div className="channel-info">
+                        <div className="channel-icon">{chatUser.name.slice(0, 1).toUpperCase()}</div>
+                        <div>
+                          <div className="channel-name">{chatUser.name}</div>
+                          <div className="channel-topic">{chatUser.email}</div>
+                        </div>
+                      </div>
+                      <div className="channel-meta">
+                        {unread > 0 && <span className="unread-badge">{unread}</span>}
+                        <span className="member-count">{chatUser.role}</span>
+                      </div>
+                      <div className="channel-actions">
+                        <span className="channel-action" aria-hidden="true">⋮</span>
+                      </div>
+                    </button>
+                  );
+                })}
+              </div>
+            </div>
+          </div>
+        </aside>
+
+        <section className="talkpai-chat-pane">
+          {selectedUser ? (
+            <div className="chat-surface">
+              <header className="thread-header">
+                <div className="thread-info">
+                  <button
+                    type="button"
+                    className="back-btn mobile-only"
+                    onClick={() => onSelectUser(null)}
+                  >
+                    ←
+                  </button>
+                  <div className="talkpai-avatar">{selectedUser.name.slice(0, 1).toUpperCase()}</div>
+                  <div>
+                    <h3>{selectedUser.name}</h3>
+                    <p className="thread-participants">{selectedUser.email}</p>
+                  </div>
+                </div>
+                <div className="thread-actions">
+                  <button type="button" className="follow-thread">Follow</button>
+                  <button type="button" className="thread-settings">Details</button>
+                </div>
+              </header>
+
+              <div className="message-stream">
+                {groupedMessages.length === 0 && (
+                  <div className="chat-placeholder">
+                    <div className="chat-placeholder-icon">💬</div>
+                    <h4>Starte das Gespräch</h4>
+                    <p>Schicke {selectedUser.name} eine Nachricht, um das Team zu synchronisieren.</p>
+                  </div>
+                )}
+
+                {groupedMessages.map(([dateKey, dayMessages]) => (
+                  <div className="chat-day" key={dateKey}>
+                    <span className="chat-day-divider">{formatDateHeader(dateKey)}</span>
+                    {dayMessages.map((message) => {
+                      const mine = message.sender_id === currentUserId;
+                      return (
+                        <div
+                          key={`${message.id}-${message.created_at}`}
+                          className={`message-row${mine ? ' from-self' : ''}`}
+                        >
+                          <div className={`message-bubble${mine ? ' self' : ''}`}>
+                            <p className="message-text">{message.message}</p>
+                            <span className="message-meta">
+                              {formatDistanceToNow(new Date(message.created_at), {
+                                addSuffix: true,
+                                locale: de
+                              })}
+                            </span>
+                          </div>
+                        </div>
+                      );
+                    })}
+                  </div>
+                ))}
+
+                <div ref={messagesEndRef} />
+              </div>
+
+              <footer className="thread-input">
+                <form className="composer" onSubmit={handleSendMessage}>
+                  <div className="composer-input">
+                    <textarea
+                      rows={1}
+                      value={messageText}
+                      onChange={(event) => setMessageText(event.target.value)}
+                      placeholder={`Nachricht an ${selectedUser.name} schreiben ...`}
+                    />
+                  </div>
+                  <div className="composer-actions">
+                    <div className="composer-tools">
+                      <button type="button" aria-label="Datei anhängen">📎</button>
+                      <button type="button" aria-label="Emoji einfügen">😊</button>
+                      <button type="button" aria-label="Erinnerung setzen">⏰</button>
+                    </div>
+                    <button
+                      type="submit"
+                      className="send-reply"
+                      disabled={!messageText.trim()}
+                    >
+                      Senden
+                    </button>
+                  </div>
+                </form>
+              </footer>
+            </div>
+          ) : (
+            <div className="chat-empty-state">
+              <div className="workspace-switcher">
+                <div className="workspace-header">
+                  <h3>Wähle einen Kanal</h3>
+                  <span>Team Messaging</span>
+                </div>
+                <div className="workspace-list">
+                  <div className="workspace-item active">
+                    <div className="workspace-avatar">BL</div>
+                    <div className="workspace-info">
+                      <span className="workspace-name">Biolab Operations</span>
+                      <span className="workspace-members">{users.length} Mitglieder online</span>
+                    </div>
+                    <span className="workspace-notification">LIVE</span>
+                  </div>
+                  <p className="workspace-hint">
+                    Wähle rechts eine Person aus, um sofort loszulegen.
+                  </p>
+                </div>
+              </div>
+            </div>
+          )}
+        </section>
+      </div>
+
+      {statusModalOpen && (
+        <div className="status-overlay" role="dialog" aria-modal="true">
+          <div className="status-selector">
+            <div className="status-header">
+              <h3>Status aktualisieren</h3>
+              <button type="button" className="close-btn" onClick={closeStatusModal}>
+                ×
+              </button>
+            </div>
+
+            <div className="status-options">
+              {STATUSES.map((status) => (
+                <button
+                  type="button"
+                  key={status.id}
+                  className="status-option"
+                  onClick={() => handleStatusSelect(status)}
+                >
+                  <span className="status-icon" aria-hidden="true">{status.icon}</span>
+                  <span className="status-text">{status.label}</span>
+                  <span className="status-color" style={{ background: status.color }} />
+                </button>
+              ))}
+            </div>
+
+            <div className="custom-status">
+              <input
+                type="text"
+                value={customStatus}
+                placeholder="Eigener Status (z. B. Fokus bis 15:00)"
+                onChange={(event) => setCustomStatus(event.target.value)}
+              />
+              <button type="button" className="set-custom-status" onClick={handleCustomStatus}>
+                Eigenen Status setzen
+              </button>
+            </div>
+          </div>
+        </div>
+      )}
+    </div>
+  );
+};
+
+export default TelegramChat;
