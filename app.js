// ============================================
// ARES SPEED - APP COMPLETO (SEM DEMO)
// Versão 3.1 - Sem login demo, apenas usuários reais
// ============================================

// ========================
// CONFIGURAÇÕES
// ========================
const APP_CONFIG = {
    MIN_SPEED: 2, // km/h - ignora abaixo disso
    MAX_SPEED: 80, // km/h - limite máximo
    FREE_DAILY_LIMIT: 5, // limite FREE por dia
    PRO_PRICE: 5.00, // preço do PRO
    AD_REFRESH_TIME: 30000 // 30 segundos para atualizar anúncios
};

// ========================
// VARIÁVEIS GLOBAIS
// ========================
let currentUser = null;
let isProUser = false;
let timerActive = false;
let startTime = 0;
let timerInterval = null;
let gpsWatch = null;
let currentSpeed = 0;
let maxSpeed = 0;
let totalDistance = 0;
let lastValidPosition = null;
let gpsReadings = [];
let rideHistory = [];
let selectedPaymentMethod = 'pix';

// ========================
// INICIALIZAÇÃO
// ========================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚵 Ares Speed inicializando...');
    
    // Carrega dados do usuário
    loadUserData();
    loadRideHistory();
    
    // Configura eventos
    setupEventListeners();
    
    // Inicializa anúncios
    initAds();
    
    console.log('✅ App pronto! Use seu email e senha para acessar.');
});

// ========================
// SISTEMA DE LOGIN (SEM DEMO)
// ========================
function showTab(tabName) {
    // Remove active de todas as tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Esconde todos os forms
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    
    // Mostra tab selecionada
    if (tabName === 'login') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('loginForm').style.display = 'block';
    } else {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('registerForm').style.display = 'block';
    }
}

function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Preencha email e senha', 'error');
        return;
    }
    
    // Procura usuário no localStorage
    const users = JSON.parse(localStorage.getItem('ares_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Usuário encontrado
        currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            isPro: user.isPro || false,
            points: user.points || 0,
            joined: user.joined || new Date().toISOString()
        };
        
        // Verifica se é PRO no localStorage
        const userProStatus = localStorage.getItem(`ares_pro_${user.id}`);
        if (userProStatus === 'true') {
            currentUser.isPro = true;
            isProUser = true;
        }
        
        saveUserData();
        showMainScreen();
        showToast(`Bem-vindo de volta, ${user.name}!`, 'success');
        
        // Sugestão de trilha
        const trailNames = ['Serra do Rio', 'Pedra Azul', 'Chapada Diamantina', 'Trilha das Cachoeiras'];
        document.getElementById('trailName').value = trailNames[Math.floor(Math.random() * trailNames.length)];
        
    } else {
        // Usuário não encontrado
        showToast('Email ou senha incorretos. Crie uma conta se for sua primeira vez.', 'error');
    }
}

function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    if (!name || !email || !password) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }
    
    // Verifica se email já existe
    const users = JSON.parse(localStorage.getItem('ares_users') || '[]');
    if (users.some(u => u.email === email)) {
        showToast('Email já cadastrado. Faça login.', 'error');
        showTab('login');
        document.getElementById('loginEmail').value = email;
        return;
    }
    
    // Cria novo usuário
    const newUser = {
        id: Date.now(),
        name: name,
        email: email,
        password: password,
        isPro: false,
        points: 0,
        joined: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('ares_users', JSON.stringify(users));
    
    // Faz login automático
    currentUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        isPro: false,
        points: 0,
        joined: newUser.joined
    };
    
    saveUserData();
    showMainScreen();
    showToast(`Conta criada com sucesso! Bem-vindo, ${name}!`, 'success');
    
    return true;
}

function logout() {
    if (confirm('Deseja sair da sua conta?')) {
        currentUser = null;
        localStorage.removeItem('ares_current_user');
        showLoginScreen();
        showToast('Você saiu da conta', 'info');
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainScreen').style.display = 'none';
    
    // Limpa os campos de login
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

function showMainScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
    
    updateUserInterface();
    loadRanking();
    updateMyRides();
    
    // Atualiza anúncios baseado no status do usuário
    updateAds();
}

// ========================
// CRONÔMETRO GPS
// ========================
function startTimer() {
    if (!currentUser) {
        showToast('Faça login primeiro!', 'error');
        showLoginScreen();
        return;
    }
    
    // Verifica limite diário para FREE
    if (!isProUser) {
        const today = new Date().toDateString();
        const todayRides = rideHistory.filter(ride => 
            new Date(ride.timestamp).toDateString() === today
        );
        
        if (todayRides.length >= APP_CONFIG.FREE_DAILY_LIMIT) {
            showToast(`Limite FREE atingido (${APP_CONFIG.FREE_DAILY_LIMIT}/dia)! Torne-se PRO para descidas ilimitadas.`, 'error');
            return;
        }
    }
    
    // Inicia cronômetro
    timerActive = true;
    startTime = Date.now();
    currentSpeed = 0;
    maxSpeed = 0;
    totalDistance = 0;
    gpsReadings = [];
    lastValidPosition = null;
    
    // Atualiza UI
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    updateValidationStatus('waiting', 'Aguardando GPS...');
    
    // Inicia contador
    timerInterval = setInterval(updateTimerDisplay, 10);
    
    // Inicia GPS
    if (navigator.geolocation) {
        startRealGPS();
    } else {
        // Modo simulação se não tiver GPS
        startSimulatedGPS();
    }
    
    showToast('Cronômetro iniciado! Boa descida! 🚵', 'success');
}

function startRealGPS() {
    gpsWatch = navigator.geolocation.watchPosition(
        handleGPSSuccess,
        handleGPSError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}

function startSimulatedGPS() {
    let simSpeed = 0;
    let simDistance = 0;
    let simTime = 0;
    
    const simInterval = setInterval(() => {
        if (!timerActive) {
            clearInterval(simInterval);
            return;
        }
        
        simTime += 1;
        
        // Simula perfil de descida realista
        if (simTime < 10) {
            simSpeed = Math.min(30, simTime * 3); // Aceleração
        } else if (simTime < 40) {
            simSpeed = 30 + Math.random() * 20; // Velocidade constante
        } else {
            simSpeed = Math.max(0, 50 - (simTime - 40) * 2); // Desaceleração
        }
        
        // Adiciona variação
        simSpeed += (Math.random() - 0.5) * 5;
        simSpeed = Math.max(0, Math.min(simSpeed, 55));
        
        // Atualiza displays
        updateSpeedDisplay(simSpeed);
        
        // Calcula distância
        const intervalDistance = (simSpeed / 3.6) * 1;
        simDistance += intervalDistance;
        document.getElementById('distance').textContent = Math.round(simDistance) + ' m';
        
        // Atualiza status
        updateValidationStatus('ok', `Modo simulação: ${simSpeed.toFixed(1)} km/h`);
        
    }, 1000);
}

function handleGPSSuccess(position) {
    if (!timerActive) return;
    
    const accuracy = position.coords.accuracy;
    const rawSpeed = position.coords.speed ? position.coords.speed * 3.6 : 0;
    
    // Valida precisão
    if (accuracy > 30) {
        updateValidationStatus('warning', `GPS impreciso (±${accuracy.toFixed(0)}m)`);
        return;
    }
    
    // Calcula velocidade
    let finalSpeed = rawSpeed;
    
    // Filtra velocidades impossíveis
    if (finalSpeed > APP_CONFIG.MAX_SPEED) {
        updateValidationStatus('error', `Velocidade impossível (${finalSpeed.toFixed(0)} km/h)`);
        return;
    }
    
    if (finalSpeed < APP_CONFIG.MIN_SPEED) {
        finalSpeed = 0;
    }
    
    // Atualiza displays
    updateSpeedDisplay(finalSpeed);
    
    // Calcula distância se tiver posição anterior
    if (lastValidPosition) {
        const distance = calculateDistance(
            lastValidPosition.coords.latitude,
            lastValidPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude
        );
        
        totalDistance += distance;
        document.getElementById('distance').textContent = Math.round(totalDistance) + ' m';
    }
    
    lastValidPosition = position;
    updateValidationStatus('ok', `GPS OK (±${accuracy.toFixed(0)}m)`);
}

function handleGPSError(error) {
    console.error('GPS Error:', error);
    updateValidationStatus('error', 'Erro GPS. Use em área aberta.');
}

function updateSpeedDisplay(speed) {
    currentSpeed = speed;
    document.getElementById('currentSpeed').textContent = speed.toFixed(1) + ' km/h';
    
    if (speed > maxSpeed) {
        maxSpeed = speed;
        document.getElementById('maxSpeed').textContent = maxSpeed.toFixed(1) + ' km/h';
    }
}

function updateValidationStatus(status, message) {
    const validation = document.getElementById('validationInfo');
    const icons = {
        waiting: '<i class="fas fa-clock" style="color:#fbc531"></i>',
        ok: '<i class="fas fa-check-circle" style="color:#00b894"></i>',
        warning: '<i class="fas fa-exclamation-triangle" style="color:#fbc531"></i>',
        error: '<i class="fas fa-times-circle" style="color:#e84118"></i>'
    };
    
    validation.innerHTML = `${icons[status] || icons.waiting} <span>${message}</span>`;
}

function stopTimer() {
    if (!timerActive) return;
    
    timerActive = false;
    const elapsedTime = Date.now() - startTime;
    
    // Para tudo
    clearInterval(timerInterval);
    if (gpsWatch) navigator.geolocation.clearWatch(gpsWatch);
    
    // Atualiza UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    
    // Salva a descida
    saveRide(elapsedTime);
}

function updateTimerDisplay() {
    if (!timerActive) return;
    
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const milliseconds = elapsed % 1000;
    
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function saveRide(elapsedTime) {
    const trailName = document.getElementById('trailName').value || 'Minha Trilha';
    
    // Cálculos
    const minutes = elapsedTime / 60000;
    const distanceKm = totalDistance / 1000;
    const avgSpeed = minutes > 0 ? distanceKm / (minutes / 60) : 0;
    
    // Validação
    let isValid = true;
    let validationMessage = '';
    
    if (maxSpeed > APP_CONFIG.MAX_SPEED) {
        isValid = false;
        validationMessage = 'Velocidade máxima acima do limite';
    } else if (avgSpeed > 60) {
        isValid = false;
        validationMessage = 'Velocidade média suspeita';
    } else if (totalDistance < 100) {
        isValid = false;
        validationMessage = 'Distância muito curta';
    }
    
    // Calcula pontos
    const points = isValid ? calculatePoints(elapsedTime, totalDistance, avgSpeed) : 0;
    
    // Cria objeto da descida
    const ride = {
        id: Date.now(),
        trail: trailName,
        time: elapsedTime,
        formattedTime: formatTime(elapsedTime),
        distance: totalDistance,
        avgSpeed: parseFloat(avgSpeed.toFixed(1)),
        maxSpeed: parseFloat(maxSpeed.toFixed(1)),
        points: points,
        isValid: isValid,
        validationMessage: validationMessage,
        timestamp: new Date().toISOString(),
        isPro: isProUser
    };
    
    // Salva no histórico
    rideHistory.push(ride);
    saveRideHistory();
    
    // Atualiza pontos do usuário
    if (isValid && points > 0) {
        currentUser.points += points;
        saveUserData();
        updateUserInterface();
    }
    
    // Mostra resultado
    if (isValid) {
        showToast(`✅ Descida registrada! ${points} pontos | ${formatTime(elapsedTime)}`, 'success');
    } else {
        showToast(`⚠️ ${validationMessage}`, 'error');
    }
    
    // Atualiza interface
    updateMyRides();
    loadRanking();
    
    // Reseta displays
    setTimeout(() => {
        document.getElementById('timer').textContent = '00:00.000';
        document.getElementById('currentSpeed').textContent = '0.0 km/h';
        document.getElementById('maxSpeed').textContent = '0.0 km/h';
        document.getElementById('distance').textContent = '0 m';
        updateValidationStatus('waiting', 'Pronto para iniciar');
    }, 2000);
}

function calculatePoints(timeMs, distanceM, avgSpeed) {
    const timeSeconds = timeMs / 1000;
    const distanceKm = distanceM / 1000;
    
    let points = 1000 / (timeSeconds / 60);
    points += distanceKm * 10;
    points += Math.min(avgSpeed, 40) * 2;
    
    if (avgSpeed > 50) points *= 0.5;
    
    return Math.round(points);
}

function formatTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// ========================
// RANKING E HISTÓRICO
// ========================
function loadRanking() {
    const rankingList = document.getElementById('rankingList');
    
    // Pega apenas descidas válidas
    const validRides = rideHistory.filter(r => r.isValid);
    
    if (validRides.length === 0) {
        rankingList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-trophy"></i><br>
                Seja o primeiro no ranking!<br>
                <small>Faça sua primeira descida</small>
            </div>
        `;
        return;
    }
    
    // Ordena por pontos
    const sorted = [...validRides].sort((a, b) => b.points - a.points);
    
    let html = '';
    sorted.slice(0, 10).forEach((ride, index) => {
        html += `
            <div class="ranking-item">
                <div class="rank">${index + 1}</div>
                <div class="user">
                    <strong>${currentUser.name}</strong>
                    ${ride.isPro ? '<span class="pro-badge">PRO</span>' : ''}
                    <div style="font-size: 0.8rem; color: #ccc;">
                        ${ride.trail}
                    </div>
                </div>
                <div class="points">
                    ${ride.points.toLocaleString()} pts
                    <div style="font-size: 0.8rem; color: #ff9f43;">
                        ${ride.maxSpeed.toFixed(1)} km/h
                    </div>
                </div>
            </div>
        `;
    });
    
    rankingList.innerHTML = html;
}

function updateMyRides() {
    const myRidesList = document.getElementById('myRidesList');
    
    if (!rideHistory.length) {
        myRidesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bicycle"></i><br>
                Nenhuma descida registrada ainda
            </div>
        `;
        return;
    }
    
    // Mostra últimas 5 descidas
    const recentRides = [...rideHistory].reverse().slice(0, 5);
    
    let html = '';
    recentRides.forEach(ride => {
        const timeStr = new Date(ride.timestamp).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        html += `
            <div class="ranking-item" style="margin-bottom: 10px; ${ride.isValid ? '' : 'opacity: 0.6;'}">
                <div class="rank" style="background: ${ride.isValid ? '#6c5ce7' : '#e84118'}; font-size: 0.9rem;">
                    <i class="fas fa-${ride.isValid ? 'check' : 'times'}"></i>
                </div>
                <div class="user" style="flex: 1;">
                    <strong>${ride.trail}</strong>
                    <div style="font-size: 0.8rem; color: #ccc;">
                        ${timeStr} • ${ride.formattedTime}
                    </div>
                    ${!ride.isValid ? 
                        `<div style="font-size: 0.7rem; color: #e84118;">
                            <i class="fas fa-exclamation-circle"></i> ${ride.validationMessage}
                        </div>` : 
                        `<div style="font-size: 0.8rem; color: #00b894;">
                            ${ride.points} pts • ${ride.maxSpeed.toFixed(1)} km/h máx
                        </div>`
                    }
                </div>
            </div>
        `;
    });
    
    myRidesList.innerHTML = html;
}

// ========================
// SISTEMA PRO E PAGAMENTOS
// ========================
function buyPro() {
    if (!currentUser) {
        showToast('Faça login primeiro!', 'error');
        showLoginScreen();
        return;
    }
    
    document.getElementById('paymentModal').style.display = 'flex';
    selectPayment('pix'); // Seleciona PIX por padrão
}

function selectPayment(method) {
    selectedPaymentMethod = method;
    
    // Remove seleção anterior
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Adiciona seleção ao método clicado
    event.currentTarget.classList.add('selected');
    
    // Mostra detalhes do pagamento
    const paymentDetails = document.getElementById('paymentDetails');
    
    if (method === 'pix') {
        paymentDetails.innerHTML = `
            <div style="background: rgba(0, 184, 148, 0.1); padding: 15px; border-radius: 10px; margin: 15px 0;">
                <h4><i class="fas fa-qrcode"></i> PIX</h4>
                <p>Valor: <strong>R$ ${APP_CONFIG.PRO_PRICE.toFixed(2)}</strong></p>
                <p>Chave PIX: <code style="background: #000; color: #fff; padding: 5px; border-radius: 5px;">325213eb-71b2-45d7-b308-4cdc94867929</code></p>
                <p><small>Após pagar, envie comprovante para liberarmos seu PRO</small></p>
            </div>
        `;
    } else if (method === 'card') {
        paymentDetails.innerHTML = `
            <div style="background: rgba(108, 92, 231, 0.1); padding: 15px; border-radius: 10px; margin: 15px 0;">
                <h4><i class="fas fa-credit-card"></i> Cartão de Crédito</h4>
                <p>Valor: <strong>R$ ${APP_CONFIG.PRO_PRICE.toFixed(2)}</strong></p>
                <p><small>Em breve: Pagamento via cartão habilitado</small></p>
                <div style="margin-top: 10px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 10px;">
                    <p><i class="fas fa-info-circle"></i> Use PIX para pagamento imediato</p>
                </div>
            </div>
        `;
    }
}

function processPayment() {
    const btn = document.getElementById('confirmPaymentBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    
    // Simula processamento de pagamento
    setTimeout(() => {
        upgradeToPro();
        closePaymentModal();
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-lock"></i> Confirmar Pagamento';
    }, 2000);
}

function upgradeToPro() {
    if (!currentUser) return;
    
    currentUser.isPro = true;
    isProUser = true;
    
    // Salva status PRO
    localStorage.setItem('ares_is_pro', 'true');
    localStorage.setItem(`ares_pro_${currentUser.id}`, 'true');
    saveUserData();
    
    // Atualiza interface
    updateUserInterface();
    
    // Remove anúncios
    updateAds();
    
    // Salva histórico de pagamento
    const payment = {
        userId: currentUser.id,
        method: selectedPaymentMethod,
        amount: APP_CONFIG.PRO_PRICE,
        date: new Date().toISOString(),
        status: 'completed'
    };
    
    const payments = JSON.parse(localStorage.getItem('ares_payments') || '[]');
    payments.push(payment);
    localStorage.setItem('ares_payments', JSON.stringify(payments));
    
    // Atualiza ranking
    loadRanking();
    
    showToast('🎉 PARABÉNS! Agora você é PRO! Anúncios removidos.', 'success');
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('paymentDetails').innerHTML = '';
}

// ========================
// GOOGLE ADSENSE
// ========================
function initAds() {
    // Configura anúncios baseado no status do usuário
    updateAds();
    
    // Atualiza anúncios periodicamente
    setInterval(updateAds, APP_CONFIG.AD_REFRESH_TIME);
}

function updateAds() {
    if (!currentUser) {
        // Não logado - não mostra anúncios
        hideAds();
        return;
    }
    
    if (isProUser) {
        // Usuário PRO - NÃO vê anúncios
        hideAds();
        document.body.classList.add('pro-user');
    } else {
        // Usuário FREE - vê anúncios
        showAds();
        document.body.classList.remove('pro-user');
    }
}

function showAds() {
    // Mostra containers de anúncio
    document.querySelectorAll('.ad-container').forEach(container => {
        container.style.display = 'flex';
        
        // Se AdSense estiver configurado, os anúncios aparecerão automaticamente
        // Se não, mostra placeholder
        if (!window.adsbygoogle || !container.querySelector('ins')) {
            container.innerHTML = `
                <div class="ad-placeholder">
                    <i class="fas fa-ad"></i><br>
                    <small>📢 ANÚNCIO</small><br>
                    <span style="font-size: 0.8rem;">Torne-se PRO para remover anúncios!</span>
                </div>
            `;
        }
    });
    
    // Tenta carregar anúncios do Google
    if (window.adsbygoogle) {
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
            console.log('✅ Anúncios Google carregados');
        } catch (e) {
            console.log('❌ Erro ao carregar anúncios:', e);
        }
    }
}

function hideAds() {
    // Esconde todos os anúncios
    document.querySelectorAll('.ad-container').forEach(container => {
        container.style.display = 'none';
    });
}

// ========================
// INTERFACE DO USUÁRIO
// ========================
function updateUserInterface() {
    if (!currentUser) return;
    
    // Nome e status
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userStatus').textContent = isProUser ? 'PRO' : 'FREE';
    document.getElementById('userStatus').className = isProUser ? 'status pro' : 'status free';
    
    // Avatar
    const avatar = document.getElementById('userAvatar');
    const initials = currentUser.name.charAt(0).toUpperCase();
    const bgColor = isProUser ? 'ff9f43' : '6c5ce7';
    avatar.src = `https://ui-avatars.com/api/?name=${initials}&background=${bgColor}&color=fff&bold=true`;
    avatar.alt = `Avatar ${currentUser.name}`;
    
    // Botão PRO
    const proBtn = document.getElementById('proBtn');
    if (isProUser) {
        proBtn.innerHTML = '<i class="fas fa-crown"></i> VOCÊ É PRO!';
        proBtn.disabled = true;
        proBtn.style.opacity = '0.7';
    } else {
        proBtn.innerHTML = `<i class="fas fa-bolt"></i> VIRAR PRO - R$ ${APP_CONFIG.PRO_PRICE.toFixed(2)}`;
        proBtn.disabled = false;
        proBtn.style.opacity = '1';
    }
}

function showSection(section) {
    // Atualiza botões ativos
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Marca o botão clicado como ativo
    event.currentTarget.classList.add('active');
    
    // Aqui você pode implementar navegação real se quiser
    const sections = {
        timer: 'Cronômetro',
        ranking: 'Ranking',
        history: 'Histórico',
        pro: 'PRO'
    };
    
    showToast(`${sections[section]} ativo`, 'info');
}

// ========================
// NOTIFICAÇÕES (TOAST)
// ========================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    const colors = {
        success: '#00b894',
        error: '#e84118',
        info: '#0984e3',
        warning: '#fdcb6e'
    };
    
    toast.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${message}`;
    toast.style.background = `linear-gradient(45deg, ${colors[type] || colors.info}, ${colors[type] || colors.info}dd)`;
    toast.className = 'toast';
    
    // Mostra
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Esconde após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================
// LOCALSTORAGE
// ========================
function saveUserData() {
    if (currentUser) {
        localStorage.setItem('ares_current_user', JSON.stringify(currentUser));
        localStorage.setItem('ares_points', currentUser.points.toString());
    }
}

function loadUserData() {
    const savedUser = localStorage.getItem('ares_current_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isProUser = currentUser.isPro || localStorage.getItem('ares_is_pro') === 'true';
        
        // Se tem usuário, mostra tela principal
        showMainScreen();
    } else {
        showLoginScreen();
    }
}

function saveRideHistory() {
    if (currentUser) {
        localStorage.setItem(`ares_rides_${currentUser.id}`, JSON.stringify(rideHistory));
    }
}

function loadRideHistory() {
    if (currentUser) {
        const savedRides = localStorage.getItem(`ares_rides_${currentUser.id}`);
        rideHistory = savedRides ? JSON.parse(savedRides) : [];
    } else {
        rideHistory = [];
    }
}

// ========================
// EVENT LISTENERS
// ========================
function setupEventListeners() {
    // Tabs do login
    document.querySelectorAll('.tab-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            showTab(index === 0 ? 'login' : 'register');
        });
    });
    
    // Forms
    document.getElementById('loginForm')?.addEventListener('submit', login);
    document.getElementById('registerForm')?.addEventListener('submit', register);
    
    // Botões PRO
    document.getElementById('proBtn')?.addEventListener('click', buyPro);
    
    // Botões de pagamento
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.addEventListener('click', function() {
            const method = this.querySelector('span').textContent.toLowerCase();
            selectPayment(method);
        });
    });
    
    // Menu inferior
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.querySelector('span').textContent.toLowerCase();
            showSection(section);
        });
    });
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && !timerActive) {
            startTimer();
        } else if (e.key === 'Escape' && timerActive) {
            stopTimer();
        }
    });
}

// ========================
// EXPORT PARA ESCOPO GLOBAL
// ========================
window.showTab = showTab;
window.login = login;
window.register = register;
window.logout = logout;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.loadRanking = loadRanking;
window.buyPro = buyPro;
window.selectPayment = selectPayment;
window.processPayment = processPayment;
window.closePaymentModal = closePaymentModal;
window.showSection = showSection;

console.log('✅ Ares Speed JavaScript carregado com sucesso!');