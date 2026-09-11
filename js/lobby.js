// CO-OP Lobby with PeerJS — shared camera, same gameplay, future skins
(function(){
  const $ = s => document.querySelector(s);
  const coopBtn = $('#coopBtn');
  const lobbyPanel = $('#lobbyPanel');
  const titleEl = $('#title');
  const controlsPanel = $('#controlsPanel');
  const closeLobby = $('#closeLobby');
  const createRoomBtn = $('#createRoomBtn');
  const joinRoomBtn = $('#joinRoomBtn');
  const joinCodeInput = $('#joinCodeInput');
  const hostInfo = $('#hostInfo');
  const roomCodeEl = $('#roomCode');
  const hostWaiting = $('#hostWaiting');
  const joinStatus = $('#joinStatus');
  const playerSelect = $('#playerSelect');
  const lobbyCreateJoin = $('#lobbyCreateJoin');
  const lobbyStatus = $('#lobbyStatus');
  const readyBtn = $('#readyBtn');
  const startCoopBtn = $('#startCoopBtn');
  const p1ReadyEl = $('#p1Ready');
  const p2ReadyEl = $('#p2Ready');
  const p1Tag = $('#p1Tag');
  const p2Tag = $('#p2Tag');

  let peer = null;
  let conn = null;
  let isHost = false;
  let myPlayer = 0; // 1 or 2
  let myChar = 0;
  let remoteChar = 0;
  let myReady = false;
  let remoteReady = false;
  let roomId = null;

  const charOptions = document.querySelectorAll('.char-option');

  function setStatus(msg, isError){
    if(lobbyStatus) { lobbyStatus.textContent = msg || ''; lobbyStatus.classList.toggle('error', !!isError); }
  }
  function setJoinStatus(msg, isError){
    if(joinStatus) { joinStatus.textContent = msg || ''; joinStatus.classList.toggle('error', !!isError); }
  }

  function showLobby(){
    if(typeof Peer === 'undefined'){
      alert('PeerJS no cargado. Revisa conexión a internet.');
      return;
    }
    // Hide title, show lobby
    titleEl.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    lobbyPanel.classList.remove('hidden');
    document.querySelector('.cabinet').classList.remove('title-mode');
    // Reset lobby state
    lobbyCreateJoin.classList.remove('hidden');
    playerSelect.classList.add('hidden');
    hostInfo.classList.add('hidden');
    startCoopBtn.classList.add('hidden');
    readyBtn.classList.remove('hidden');
    readyBtn.textContent = 'LISTO';
    readyBtn.disabled = false;
    myReady = false; remoteReady = false;
    isHost = false; myPlayer = 0;
    myChar = 0; remoteChar = 0;
    updateReadyUI();
    setStatus('');
    setJoinStatus('');
    if(peer){ try{peer.destroy();}catch(e){} peer=null; conn=null; }
    updateCharSelection();
  }
  function hideLobby(){
    lobbyPanel.classList.add('hidden');
    // Return to title if not in coop
    if(!window.coopState || !window.coopState.isCoop){
      document.querySelector('.cabinet').classList.add('title-mode');
      titleEl.classList.remove('hidden');
    }
    if(peer && !window.coopState?.isCoop){
      try{peer.destroy();}catch(e){}
      peer=null; conn=null;
    }
  }

  function updateCharSelection(){
    charOptions.forEach(btn=>{
      const p = parseInt(btn.dataset.player);
      const c = parseInt(btn.dataset.char);
      const isMine = p === myPlayer;
      btn.classList.toggle('selected', (p===1 ? (myPlayer===1?myChar:remoteChar) : (myPlayer===2?myChar:remoteChar)) === c);
      // Disable opponent's choices visually but allow viewing
      // Only own slot is interactive
      btn.disabled = !isMine && conn; // if connected, disable opponent slot
      btn.style.opacity = isMine ? '1' : '0.7';
    });
    // Highlight active slot
    document.querySelectorAll('.player-slot').forEach(el=>el.classList.remove('active'));
    if(myPlayer===1) $('#slot1')?.classList.add('active');
    if(myPlayer===2) $('#slot2')?.classList.add('active');
  }

  function updateReadyUI(){
    if(p1ReadyEl) {
      const ready = (myPlayer===1 ? myReady : remoteReady);
      p1ReadyEl.textContent = ready ? '✓ LISTO' : 'Esperando...';
      p1ReadyEl.classList.toggle('ready', ready);
    }
    if(p2ReadyEl){
      const ready = (myPlayer===2 ? myReady : remoteReady);
      p2ReadyEl.textContent = ready ? '✓ LISTO' : 'Esperando...';
      p2ReadyEl.classList.toggle('ready', ready);
    }
    if(readyBtn){
      readyBtn.textContent = myReady ? 'CANCELAR LISTO' : 'LISTO';
      readyBtn.style.background = myReady ? '#00FFD122' : '';
      readyBtn.style.borderColor = myReady ? '#00FFD1' : '';
    }
    // Tags
    if(p1Tag) p1Tag.textContent = myPlayer===1 ? '(TÚ)' : (isHost && myPlayer===1 ? '(TÚ - HOST)' : myPlayer===0 ? '' : '(HOST)');
    if(p2Tag) p2Tag.textContent = myPlayer===2 ? '(TÚ)' : (isHost ? '' : '(HOST)');
    // Host can start only if both ready
    if(isHost){
      if(myReady && remoteReady){
        startCoopBtn.classList.remove('hidden');
        setStatus('¡Ambos listos! Puedes iniciar.');
      } else {
        startCoopBtn.classList.add('hidden');
        if(conn) setStatus('Esperando a que ambos estén listos...');
      }
    } else {
      startCoopBtn.classList.add('hidden');
      if(myReady && remoteReady) setStatus('Esperando a que el host inicie...');
      else if(conn) setStatus(conn ? 'Conectado. Elige personaje y pulsa LISTO.' : '');
    }
  }

  function setupConnectionHandlers(c){
    conn = c;
    conn.on('data', handleData);
    conn.on('close', ()=>{
      setStatus('Jugador desconectado', true);
      setJoinStatus('Conexión cerrada', true);
      playerSelect.classList.add('hidden');
      lobbyCreateJoin.classList.remove('hidden');
      hostInfo.classList.add('hidden');
      startCoopBtn.classList.add('hidden');
    });
    conn.on('error', err=>{
      setStatus('Error de conexión: '+(err?.message||err), true);
    });
  }

  function handleData(data){
    if(!data || !data.type) return;
    if(data.type==='char'){
      remoteChar = data.char;
      updateCharSelection();
      updateReadyUI();
    } else if(data.type==='ready'){
      remoteReady = data.ready;
      updateReadyUI();
    } else if(data.type==='start'){
      // Guest receives start signal
      remoteChar = data.hostChar ?? remoteChar;
      myChar = data.guestChar ?? myChar;
      // Save coop state and start game
      window.coopState = {
        isCoop: true,
        isHost: false,
        myPlayer: 2,
        myChar: myChar,
        remoteChar: remoteChar,
        peer: peer,
        conn: conn,
        hostId: data.hostId || roomId
      };
      try{ sessionStorage.setItem('coopState', JSON.stringify({isCoop:true,isHost:false,myPlayer:2,myChar,remoteChar})); }catch(e){}
      startCoopGame();
    } else if(data.type==='sync' || data.type==='input' || data.type==='state'){
      // Forward to game.js handler if exists
      if(window.handleCoopData) window.handleCoopData(data);
    }
  }

  function send(data){
    if(conn && conn.open){
      try{ conn.send(data); }catch(e){}
    }
  }

  // CHARACTER SELECTION
  charOptions.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = parseInt(btn.dataset.player);
      const c = parseInt(btn.dataset.char);
      if(p !== myPlayer) return; // can only change own
      myChar = c;
      updateCharSelection();
      send({type:'char', char: myChar});
    });
  });

  // CREATE ROOM
  if(createRoomBtn){
    createRoomBtn.addEventListener('click', ()=>{
      if(peer) { try{peer.destroy();}catch(e){} }
      isHost = true;
      myPlayer = 1;
      myChar = 0; remoteChar = 0;
      setStatus('Creando sala... (conectando a PeerJS)');
      // Generate short readable id (6 chars for less collision)
      const shortId = 'iron-'+Math.random().toString(36).substring(2,8).toUpperCase();
      try { peer = new Peer(shortId); } catch(e) { peer = new Peer(); }
      window._coopPeer = peer;
      let openTimeout = setTimeout(()=>{ if(!roomId) setStatus('Tardando en conectar... revisa internet/firewall', true); }, 4000);
      peer.on('open', id=>{
        clearTimeout(openTimeout);
        roomId = id;
        console.log('[COOP] Sala creada:', id);
        roomCodeEl.textContent = id;
        hostInfo.classList.remove('hidden');
        lobbyCreateJoin.classList.add('hidden');
        playerSelect.classList.remove('hidden');
        setStatus('¡Sala creada! Comparte el código: '+id);
        updateCharSelection();
        updateReadyUI();
      });
      peer.on('connection', c=>{
        if(conn && conn.open){
          c.close();
          return;
        }
        setupConnectionHandlers(c);
        c.on('open', ()=>{
          hostWaiting.textContent = '¡Jugador 2 conectado!';
          setStatus('Jugador 2 conectado. Elige personaje.');
          // Sync initial char
          send({type:'char', char: myChar});
          updateReadyUI();
        });
      });
      peer.on('error', err=>{
        console.error('[COOP] Peer error host', err);
        if(err?.type==='unavailable-id'){
          setStatus('ID en uso, reintentando...', true);
          try{peer.destroy();}catch(e){}
          peer = new Peer(); // fallback random
          window._coopPeer = peer;
          peer.on('open', id=>{
            roomId = id;
            console.log('[COOP] Sala creada (fallback):', id);
            roomCodeEl.textContent = id;
            hostInfo.classList.remove('hidden');
            lobbyCreateJoin.classList.add('hidden');
            playerSelect.classList.remove('hidden');
            setStatus('¡Sala creada! Código: '+id);
            updateCharSelection();
            updateReadyUI();
          });
          peer.on('connection', c=>{
            if(conn && conn.open){ c.close(); return; }
            setupConnectionHandlers(c);
            c.on('open', ()=>{
              hostWaiting.textContent = '¡Jugador 2 conectado!';
              setStatus('Jugador 2 conectado. Elige personaje.');
              send({type:'char', char: myChar});
              updateReadyUI();
            });
          });
          peer.on('error', e2=> setStatus('Error PeerJS: '+(e2?.message||e2), true));
          return;
        }
        setStatus('Error PeerJS: '+(err?.message||err?.type||err), true);
      });
    });
  }

  // JOIN ROOM
  if(joinRoomBtn){
    joinRoomBtn.addEventListener('click', ()=>{
      const code = joinCodeInput.value.trim();
      if(!code){ setJoinStatus('Introduce un código', true); return; }
      isHost = false;
      myPlayer = 2;
      myChar = 0; remoteChar = 0;
      setJoinStatus('Conectando a '+code+'...');
      peer = new Peer();
      window._coopPeer = peer;
      let guestTimeout = setTimeout(()=>{ setJoinStatus('Tardando... verifica código y conexión', true); }, 5000);
      peer.on('open', ()=>{
        clearTimeout(guestTimeout);
        console.log('[COOP] Peer guest abierto, conectando a', code);
        roomId = code;
        const c = peer.connect(code, {reliable:true});
        if(!c){ setJoinStatus('No se pudo conectar. Código inválido.', true); return; }
        setupConnectionHandlers(c);
        let connTimeout = setTimeout(()=>{ setJoinStatus('No se pudo conectar al host. Verifica código.', true); }, 6000);
        c.on('open', ()=>{
          clearTimeout(connTimeout);
          console.log('[COOP] Conectado al host', code);
          setJoinStatus('¡Conectado!');
          lobbyCreateJoin.classList.add('hidden');
          hostInfo.classList.add('hidden');
          playerSelect.classList.remove('hidden');
          setStatus('Conectado al host. Elige personaje.');
          send({type:'char', char: myChar});
          updateCharSelection();
          updateReadyUI();
        });
        c.on('error', err=> { clearTimeout(connTimeout); setJoinStatus('Error conexión: '+(err?.message||err), true); console.error(err); });
      });
      peer.on('error', err=>{
        clearTimeout(guestTimeout);
        console.error('[COOP] Peer error guest', err);
        let msg = err?.type==='peer-unavailable' ? 'Sala no encontrada. Verifica código.' : (err?.message||err?.type||err);
        setJoinStatus('Error PeerJS: '+msg, true);
        setStatus('Error: '+msg, true);
      });
    });
  }

  // READY
  if(readyBtn){
    readyBtn.addEventListener('click', ()=>{
      if(!conn || !conn.open){
        setStatus('Conecta primero a una sala', true);
        return;
      }
      myReady = !myReady;
      send({type:'ready', ready: myReady});
      updateReadyUI();
    });
  }

  // START (host only)
  if(startCoopBtn){
    startCoopBtn.addEventListener('click', ()=>{
      if(!isHost){ setStatus('Solo el host puede iniciar', true); return; }
      if(!myReady || !remoteReady){ setStatus('Ambos deben estar listos', true); return; }
      // Notify guest
      send({type:'start', hostChar: myChar, guestChar: remoteChar, hostId: peer.id});
      window.coopState = {
        isCoop: true,
        isHost: true,
        myPlayer: 1,
        myChar: myChar,
        remoteChar: remoteChar,
        peer: peer,
        conn: conn,
        hostId: peer.id
      };
      try{ sessionStorage.setItem('coopState', JSON.stringify({isCoop:true,isHost:true,myPlayer:1,myChar,remoteChar,hostId:peer.id})); }catch(e){}
      startCoopGame();
    });
  }

  function startCoopGame(){
    lobbyPanel.classList.add('hidden');
    // Setup HUD for coop
    const p2Hud = document.getElementById('p2Hud');
    const p2Help = document.getElementById('p2Help');
    const coopIndicator = document.getElementById('coopIndicator');
    if(p2Hud) p2Hud.classList.remove('hidden');
    if(p2Help) p2Help.classList.remove('hidden');
    if(coopIndicator) coopIndicator.classList.remove('hidden');
    document.querySelector('.cabinet').classList.remove('title-mode');
    document.getElementById('title').classList.add('hidden');
    // Notify game.js
    if(window.initCoopMode) window.initCoopMode(window.coopState);
    else {
      // Fallback: set global and reload game logic
      window.coopEnabled = true;
      // Trigger game start via existing function if needed
      if(typeof rebuildMenu === 'function'){
        // Game will handle coop in its own init
      }
    }
    // Ensure music handling
    try{
      const titleMusic = window.titleMusic || document.querySelector('audio');
      // Game.js will handle music via its own handlers; just ensure started
      if(window.started !== undefined){
        window.started = true;
      }
    }catch(e){}
    setStatus('Iniciando CO-OP...');
    // Hide lobby completely
    lobbyPanel.classList.add('hidden');
    // Store that we are in coop for reloads
    try{
      const s = window.coopState;
      sessionStorage.setItem('coopActive', JSON.stringify({isHost: s.isHost, myPlayer: s.myPlayer, myChar: s.myChar, remoteChar: s.remoteChar, hostId: s.hostId || roomId}));
    }catch(e){}
  }

  // Expose for game.js
  window.getCoopState = ()=> window.coopState;
  window.sendCoopData = send;
  window.startCoopGame = startCoopGame;

  // BUTTON HANDLERS
  if(coopBtn){
    coopBtn.addEventListener('click', showLobby);
  }
  if(closeLobby){
    closeLobby.addEventListener('click', hideLobby);
  }
  // Close lobby with ESC
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && !lobbyPanel.classList.contains('hidden')){
      hideLobby();
    }
  });

  // Auto-restore coop state if reloading in coop
  try{
    const saved = sessionStorage.getItem('coopActive');
    if(saved){
      const parsed = JSON.parse(saved);
      // If we reload index.html while in coop, restore minimal state for game.js to pick up
      // game.js will check sessionStorage coopActive on load
    }
  }catch(e){}

})();
