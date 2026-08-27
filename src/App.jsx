import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const STORAGE_KEY = 'halo-chat-profile';
const defaultServerUrl = window.desktop?.serverUrl || 'http://127.0.0.1:3020';

function Icon({ name, size = 20 }) {
  const paths = {
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
    hash: <><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"/></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19c0 1.1-.9 2-2 2h-2M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></>,
    micOff: <><path d="m2 2 20 20M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 11.34 5.48M12 19v3M8 22h8"/></>,
    phoneOff: <><path d="m2 2 20 20M10.7 6.7 9.26 4.35A2 2 0 0 0 6.55 3.6l-1.8.9a2 2 0 0 0-1.1 2.2c1.1 6.6 6.3 11.8 12.9 12.9a2 2 0 0 0 2.2-1.1l.9-1.8a2 2 0 0 0-.75-2.71l-2.35-1.44a2 2 0 0 0-2.45.3l-.84.84"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.33.7.6 1 .3.27.68.4 1.1.4h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.7.6z"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></>,
    spark: <><path d="m12 3-1.6 4.4L6 9l4.4 1.6L12 15l1.6-4.4L18 9l-4.4-1.6zM5 16l-.8 2.2L2 19l2.2.8L5 22l.8-2.2L8 19l-2.2-.8zM19 14l-.6 1.4L17 16l1.4.6L19 18l.6-1.4L21 16l-1.4-.6z"/></>,
    wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function readSavedProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.name && value?.serverUrl) return value;
  } catch {
    // Ignore corrupt local settings.
  }
  return null;
}

function initials(name) {
  return [...String(name || '?')].slice(0, 2).join('').toUpperCase();
}

function colorFor(name) {
  const palettes = [
    ['#7066f0', '#9a8cff'],
    ['#2a9d8f', '#58d6b5'],
    ['#e76f51', '#ff9f76'],
    ['#3876d9', '#65a7ff'],
    ['#c059b9', '#f18ce7'],
  ];
  const index = [...String(name)].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % palettes.length;
  return `linear-gradient(145deg, ${palettes[index][0]}, ${palettes[index][1]})`;
}

function Avatar({ name, size = 'normal', online = false }) {
  return (
    <span className={`avatar avatar--${size}`} style={{ background: colorFor(name) }} aria-label={name}>
      {initials(name)}
      {online && <span className="avatar__status" />}
    </span>
  );
}

function SetupScreen({ initialProfile, onSave }) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [serverUrl, setServerUrl] = useState(initialProfile?.serverUrl || defaultServerUrl);
  const [accessKey, setAccessKey] = useState(initialProfile?.accessKey || '');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    const trimmedName = name.trim().slice(0, 32);
    let normalizedUrl;
    try {
      const parsed = new URL(serverUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
      normalizedUrl = parsed.origin;
    } catch {
      setError('接続先は http:// または https:// から入力してください。');
      return;
    }
    if (!trimmedName) {
      setError('表示名を入力してください。');
      return;
    }
    onSave({ name: trimmedName, serverUrl: normalizedUrl, accessKey: accessKey.trim() });
  }

  return (
    <main className="setup-shell">
      <div className="setup-glow setup-glow--one" />
      <div className="setup-glow setup-glow--two" />
      <section className="setup-card">
        <div className="brand-mark brand-mark--large"><span /></div>
        <p className="eyebrow">YOUR SPACE, YOUR PEOPLE</p>
        <h1>Halo Chatへようこそ</h1>
        <p className="setup-card__lead">小さなチームのための、静かで軽いチャット空間です。</p>
        <form onSubmit={submit}>
          <label>
            <span>表示名</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="例：Haruto" autoFocus />
          </label>
          <label>
            <span>サーバーURL</span>
            <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} spellCheck="false" />
            <small>このPCの内蔵サーバーを使う場合は、そのままで大丈夫です。</small>
          </label>
          <label>
            <span>アクセスキー <em>任意</em></span>
            <input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} placeholder="サーバー管理者から受け取ったキー" autoComplete="current-password" />
            <small>クラウド版または保護されたサーバーへ接続するときだけ入力します。</small>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">チャットを始める <Icon name="chevron" size={17} /></button>
        </form>
        <div className="setup-note"><span className="pulse-dot" /> 内蔵サーバーはアプリと一緒に起動します</div>
      </section>
    </main>
  );
}

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function App() {
  const [profile, setProfile] = useState(readSavedProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [connectionError, setConnectionError] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('general');
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [voice, setVoice] = useState({ joined: false, muted: false, error: '' });
  const [voicePeers, setVoicePeers] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (window.desktop) return 'granted';
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

  const socketRef = useRef(null);
  const socketIdRef = useRef('');
  const profileRef = useRef(profile);
  const roomIdRef = useRef(roomId);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  profileRef.current = profile;
  roomIdRef.current = roomId;

  const removePeer = useCallback((peerId) => {
    const peer = peerConnectionsRef.current.get(peerId);
    peer?.close();
    peerConnectionsRef.current.delete(peerId);
    document.getElementById(`remote-audio-${peerId}`)?.remove();
    setVoicePeers((current) => current.filter((item) => item.id !== peerId));
  }, []);

  const createPeer = useCallback((peerId) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('voice:signal', {
          targetId: peerId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };
    peer.ontrack = (event) => {
      let audio = document.getElementById(`remote-audio-${peerId}`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `remote-audio-${peerId}`;
        audio.autoplay = true;
        document.getElementById('remote-audio-root')?.appendChild(audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(peer.connectionState)) removePeer(peerId);
    };
    peerConnectionsRef.current.set(peerId, peer);
    return peer;
  }, [removePeer]);

  const leaveVoice = useCallback(() => {
    socketRef.current?.emit('voice:leave');
    peerConnectionsRef.current.forEach((peer, id) => {
      peer.close();
      document.getElementById(`remote-audio-${id}`)?.remove();
    });
    peerConnectionsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setVoicePeers([]);
    setVoice({ joined: false, muted: false, error: '' });
  }, []);

  useEffect(() => {
    if (!profile) return undefined;
    const socket = io(profile.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 700,
      timeout: 6000,
      auth: { accessKey: profile.accessKey || '' },
    });
    socketRef.current = socket;
    setConnection('connecting');
    setConnectionError('');

    socket.on('connect', () => {
      setConnection('online');
      setConnectionError('');
      socket.emit('session:join', { name: profile.name, roomId: roomIdRef.current }, (state) => {
        if (!state?.ok) return;
        socketIdRef.current = state.socketId;
        setRooms(state.rooms);
        setRoomId(state.roomId);
        setMessages(state.messages);
        setMembers(state.members);
      });
    });
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', (error) => {
      setConnection('offline');
      setConnectionError(error.message === 'ACCESS_DENIED' ? 'アクセスキーが違います' : 'サーバーに接続できません');
    });
    socket.on('presence:update', setMembers);
    socket.on('message:new', (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderId !== socketIdRef.current && document.hidden) {
        if (window.desktop?.notify) {
          window.desktop.notify({ title: `${message.senderName} • Halo Chat`, body: message.content });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(`${message.senderName} • Halo Chat`, { body: message.content, icon: './halo.svg' });
          notification.onclick = () => window.focus();
        }
      }
    });
    socket.on('typing:update', ({ id, name, active }) => {
      setTypingUsers((current) => {
        const next = { ...current };
        if (active) next[id] = name;
        else delete next[id];
        return next;
      });
    });
    socket.on('voice:peer-joined', (peer) => {
      setVoicePeers((current) => current.some((item) => item.id === peer.id) ? current : [...current, peer]);
    });
    socket.on('voice:peer-left', ({ id }) => removePeer(id));
    socket.on('voice:signal', async ({ fromId, fromName, signal }) => {
      try {
        const peer = createPeer(fromId);
        setVoicePeers((current) => current.some((item) => item.id === fromId) ? current : [...current, { id: fromId, name: fromName }]);
        if (signal.type === 'offer') {
          await peer.setRemoteDescription(signal.description);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('voice:signal', { targetId: fromId, signal: { type: 'answer', description: peer.localDescription } });
        } else if (signal.type === 'answer') {
          await peer.setRemoteDescription(signal.description);
        } else if (signal.type === 'candidate' && signal.candidate) {
          await peer.addIceCandidate(signal.candidate);
        }
      } catch (error) {
        setVoice((current) => ({ ...current, error: `通話接続に失敗しました: ${error.message}` }));
      }
    });

    return () => {
      leaveVoice();
      socket.close();
      socketRef.current = null;
    };
  }, [profile, createPeer, leaveVoice, removePeer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const currentRoom = useMemo(
    () => rooms.find((room) => room.id === roomId) || { id: roomId, name: '読み込み中', description: '' },
    [rooms, roomId],
  );

  const inVoice = members.filter((member) => member.inVoice);
  const typingNames = Object.values(typingUsers);

  function saveProfile(nextProfile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
    setEditingProfile(false);
    setProfile(nextProfile);
  }

  async function enableNotifications() {
    if (window.desktop || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  function switchRoom(nextRoomId) {
    if (nextRoomId === roomId || connection !== 'online') return;
    leaveVoice();
    setTypingUsers({});
    socketRef.current?.emit('room:switch', { roomId: nextRoomId }, (state) => {
      if (!state?.ok) return;
      setRoomId(state.roomId);
      setMessages(state.messages);
      setMembers(state.members);
    });
  }

  function sendMessage(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || connection !== 'online') return;
    setText('');
    socketRef.current?.emit('typing:set', { active: false });
    socketRef.current?.emit('message:send', { content });
  }

  function updateDraft(value) {
    setText(value);
    socketRef.current?.emit('typing:set', { active: Boolean(value.trim()) });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing:set', { active: false }), 1400);
  }

  async function joinVoice() {
    try {
      setVoice((current) => ({ ...current, error: '' }));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      localStreamRef.current = stream;
      socketRef.current?.emit('voice:join', {}, async (state) => {
        if (!state?.ok) return leaveVoice();
        setVoice({ joined: true, muted: false, error: '' });
        setVoicePeers(state.peers);
        for (const remote of state.peers) {
          const peer = createPeer(remote.id);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socketRef.current?.emit('voice:signal', {
            targetId: remote.id,
            signal: { type: 'offer', description: peer.localDescription },
          });
        }
      });
    } catch (error) {
      setVoice({ joined: false, muted: false, error: error.name === 'NotAllowedError' ? 'マイクの使用が許可されていません。' : error.message });
    }
  }

  function toggleMute() {
    const nextMuted = !voice.muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setVoice((current) => ({ ...current, muted: nextMuted }));
  }

  if (!profile || editingProfile) {
    return <SetupScreen initialProfile={profile} onSave={saveProfile} />;
  }

  return (
    <div className="app-shell">
      <nav className="workspace-rail" aria-label="ワークスペース">
        <button className="brand-mark brand-mark--rail" title="Halo Chat"><span /></button>
        <div className="rail-line" />
        <button className="rail-button rail-button--active" title="チャット"><Icon name="chat" /></button>
        <button className="rail-button" title="メンバー"><Icon name="users" /></button>
        <span className="rail-spacer" />
        <button className="rail-button" title="接続設定" onClick={() => setEditingProfile(true)}><Icon name="settings" /></button>
      </nav>

      <aside className="channel-panel">
        <header className="space-header">
          <div>
            <span className="space-header__label">ワークスペース</span>
            <strong>Halo House</strong>
          </div>
          <span className={`connection-pill connection-pill--${connection}`}>
            <span /> {connection === 'online' ? '接続中' : connection === 'connecting' ? '接続中…' : connectionError || '再接続中'}
          </span>
        </header>

        <div className="channel-scroll">
          <div className="section-label"><span>テキストチャンネル</span><button aria-label="チャンネルを追加">＋</button></div>
          <div className="channel-list">
            {rooms.map((room) => (
              <button key={room.id} className={room.id === roomId ? 'channel-item channel-item--active' : 'channel-item'} onClick={() => switchRoom(room.id)}>
                <Icon name="hash" size={17} /><span>{room.name}</span>
                {room.id === roomId && <span className="channel-item__marker" />}
              </button>
            ))}
          </div>

          <div className="section-label section-label--voice"><span>ボイスチャンネル</span></div>
          <button className={voice.joined ? 'voice-channel voice-channel--active' : 'voice-channel'} onClick={voice.joined ? undefined : joinVoice}>
            <span className="voice-channel__icon"><Icon name="volume" size={17} /></span>
            <span><strong>{currentRoom.name}</strong><small>{inVoice.length || voicePeers.length ? `${Math.max(inVoice.length, voicePeers.length + 1)}人が参加中` : 'クリックして参加'}</small></span>
          </button>
          {inVoice.map((member) => (
            <div className="voice-member" key={member.id}><Avatar name={member.name} size="tiny" /><span>{member.name}</span><Icon name="mic" size={13} /></div>
          ))}
          {voice.error && <p className="voice-error">{voice.error}</p>}
        </div>

        {voice.joined && (
          <section className="call-controls">
            <div className="call-controls__status"><span className="signal-bars"><i/><i/><i/></span><div><strong>音声接続済み</strong><small>{currentRoom.name}</small></div></div>
            <div className="call-controls__buttons">
              <button className={voice.muted ? 'is-danger' : ''} onClick={toggleMute} title={voice.muted ? 'ミュート解除' : 'ミュート'}><Icon name={voice.muted ? 'micOff' : 'mic'} size={17} /></button>
              <button className="is-danger" onClick={leaveVoice} title="切断"><Icon name="phoneOff" size={17} /></button>
            </div>
          </section>
        )}

        <footer className="profile-bar">
          <Avatar name={profile.name} online />
          <div><strong>{profile.name}</strong><span>オンライン</span></div>
          <button onClick={() => setEditingProfile(true)} title="設定"><Icon name="settings" size={18} /></button>
        </footer>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div className="chat-header__title"><span className="channel-glyph"><Icon name="hash" size={19} /></span><div><strong>{currentRoom.name}</strong><span>{currentRoom.description}</span></div></div>
          <select className="mobile-room-select" value={roomId} onChange={(event) => switchRoom(event.target.value)} aria-label="チャンネル">
            {rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}
          </select>
          <div className="chat-header__meta">
            {!window.desktop && notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
              <button className="header-icon-button" onClick={enableNotifications} title="通知を有効化"><Icon name="bell" size={17} /></button>
            )}
            <span><Icon name="users" size={17} /> {members.length}</span>
            <span className="secure-pill"><Icon name="wifi" size={14} /> LIVE</span>
            {voice.joined && (
              <button className={`header-icon-button mobile-only ${voice.muted ? 'is-danger' : ''}`} onClick={toggleMute} title={voice.muted ? 'ミュート解除' : 'ミュート'}><Icon name={voice.muted ? 'micOff' : 'mic'} size={17} /></button>
            )}
            <button className={`header-icon-button mobile-only ${voice.joined ? 'is-danger' : ''}`} onClick={voice.joined ? leaveVoice : joinVoice} title={voice.joined ? '音声通話から退出' : '音声通話に参加'}><Icon name={voice.joined ? 'phoneOff' : 'headset'} size={17} /></button>
            <button className="header-icon-button mobile-only" onClick={() => setEditingProfile(true)} title="接続設定"><Icon name="settings" size={17} /></button>
          </div>
        </header>

        <section className="message-list" aria-live="polite">
          <div className="room-intro">
            <span className="room-intro__icon"><Icon name="spark" size={27} /></span>
            <div><p className="eyebrow">CHANNEL OPEN</p><h2>#{currentRoom.name}へようこそ</h2><p>{currentRoom.description}。最初のメッセージを送って会話を始めましょう。</p></div>
          </div>
          <div className="date-divider"><span>最近のメッセージ</span></div>
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const grouped = previous?.senderId === message.senderId && new Date(message.createdAt) - new Date(previous.createdAt) < 5 * 60 * 1000;
            return (
              <article className={grouped ? 'message message--grouped' : 'message'} key={message.id}>
                {!grouped && <Avatar name={message.senderName} />}
                <div className="message__body">
                  {!grouped && <div className="message__meta"><strong>{message.senderName}</strong>{message.senderId === socketIdRef.current && <span className="you-badge">YOU</span>}<time>{formatTime(message.createdAt)}</time></div>}
                  <p>{message.content}</p>
                </div>
              </article>
            );
          })}
          <div ref={messagesEndRef} />
        </section>

        <div className="composer-wrap">
          <div className="typing-line">
            {typingNames.length > 0 ? <><span className="typing-dots"><i/><i/><i/></span><strong>{typingNames.join('、')}</strong> が入力しています</> : <span>&nbsp;</span>}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <button type="button" className="composer__add" title="添付（準備中）">＋</button>
            <textarea
              value={text}
              onChange={(event) => updateDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) sendMessage(event);
              }}
              placeholder={connection === 'online' ? `#${currentRoom.name}にメッセージを送信` : 'サーバーに再接続しています…'}
              rows={1}
              disabled={connection !== 'online'}
            />
            <button className="composer__send" type="submit" disabled={!text.trim() || connection !== 'online'} title="送信"><Icon name="send" size={18} /></button>
          </form>
          <div className="composer-hint"><span><kbd>Enter</kbd> で送信</span><span><kbd>Shift</kbd> + <kbd>Enter</kbd> で改行</span></div>
        </div>
      </main>

      <aside className="member-panel">
        <header><span>メンバー</span><span className="count-badge">{members.length}</span></header>
        <div className="member-section-label">オンライン — {members.length}</div>
        <div className="member-list">
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <Avatar name={member.name} online />
              <div><strong>{member.name}</strong><span>{member.inVoice ? '音声チャンネルに参加中' : member.id === socketIdRef.current ? 'あなた' : 'オンライン'}</span></div>
              {member.inVoice && <span className="member-row__voice"><Icon name="mic" size={13} /></span>}
            </div>
          ))}
        </div>
        <div className="member-panel__tip"><Icon name="spark" size={18} /><p><strong>ちいさなヒント</strong><span>アプリを閉じてもタスクトレイで待機し、新着メッセージを通知します。</span></p></div>
      </aside>
    </div>
  );
}
