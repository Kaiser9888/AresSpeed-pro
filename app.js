// ============================================
// ARES SPEED - APP COMPLETO (VERSÃO FINAL)
// ============================================

// ========================
// CONFIGURAÇÕES (MODIFIQUE AQUI!)
// ========================
const CONFIG = {
    // SUAS INFORMAÇÕES DE PAGAMENTO (OBRIGATÓRIO!)
    SEUS_DADOS: {
        nome: "SEU NOME COMPLETO", // ← SEU NOME AQUI
        pix: "325213eb-71b2-45d7-b308-4cdc94867929", // SUA CHAVE PIX
        banco: "SEU BANCO", // ← NOME DO SEU BANCO
        whatsapp: "5511999999999", // ← SEU WHATSAPP COM DDI/DDD
        email: "seu.email@gmail.com", // ← SEU EMAIL
        valor: 5.00
    },
    
    // CONFIGURAÇÕES DO APP
    APP: {
        MIN_SPEED: 2,
        MAX_SPEED: 80,
        FREE_DAILY_LIMIT: 5,
        PRO_PRICE: 5.00,
        AD_REFRESH_TIME: 30000
    }
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
let paymentPending = false;
let paymentCode = "";

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
    
    console.log('✅ App pronto! PIX: ' + CONFIG.SEUS_DADOS.pix);
});

// ========================
// SISTEMA DE LOGIN
// ========================
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    
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
    
    const users = JSON.parse(localStorage.getItem('ares_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            isPro: user.isPro || false,
            points: user.points || 0,
            joined: user.joined || new Date().toISOString()
        };
        
        const userProStatus = localStorage.getItem(`ares_pro_${user.id}`);
        if (userProStatus === 'true') {
            currentUser.isPro = true;
            isProUser = true;
        }
        
        saveUserData();
        showMainScreen();
        showToast(`Bem-vindo de volta, ${user.name}!`, 'success');
        
        const trailNames = ['Serra do Rio', 'Pedra Azul', 'Chapada Diamantina', 'Trilha das Cachoeiras'];
        document.getElementById('trailName').value = trailNames[Math.floor(Math.random() * trailNames.length)];
        
    } else {
        showToast('Email ou senha incorretos.', 'error');
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
    
    const users = JSON.parse(localStorage.getItem('ares_users') || '[]');
    if (users.some(u => u.email === email)) {
        showToast('Email já cadastrado. Faça login.', 'error');
        showTab('login');
        document.getElementById('loginEmail').value = email;
        return;
    }
    
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
    showToast(`Conta criada! Bem-vindo, ${name}!`, 'success');
    
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
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

function showMainScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
    
    updateUserInterface();
    loadRanking();
    updateMyRides();
    
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
    
    if (!isProUser) {
        const today = new Date().toDateString();
        const todayRides = rideHistory.filter(ride =>
            new Date(ride.timestamp).toDateString() === today
        );
        
        if (todayRides.length >= CONFIG.APP.FREE_DAILY_LIMIT) {
            showToast(`Limite FREE (${CONFIG.APP.FREE_DAILY_LIMIT}/dia)! Vire PRO.`, 'error');
            return;
        }
    }
    
    timerActive = true;
    startTime = Date.now();
    currentSpeed = 0;
    maxSpeed = 0;
    totalDistance = 0;
    gpsReadings = [];
    lastValidPosition = null;
    
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    updateValidationStatus('waiting', 'Aguardando GPS...');
    
    timerInterval = setInterval(updateTimerDisplay, 10);
    
    if (navigator.geolocation) {
        startRealGPS();
    } else {
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
        
        if (simTime < 10) {
            simSpeed = Math.min(30, simTime * 3);
        } else if (simTime < 40) {
            simSpeed = 30 + Math.random() * 20;
        } else {
            simSpeed = Math.max(0, 50 - (simTime - 40) * 2);
        }
        
        simSpeed += (Math.random() - 0.5) * 5;
        simSpeed = Math.max(0, Math.min(simSpeed, 55));
        
        updateSpeedDisplay(simSpeed);
        
        const intervalDistance = (simSpeed / 3.6) * 1;
        simDistance += intervalDistance;
        document.getElementById('distance').textContent = Math.round(simDistance) + ' m';
        
        updateValidationStatus('ok', `Modo simulação: ${simSpeed.toFixed(1)} km/h`);
        
    }, 1000);
}

function handleGPSSuccess(position) {
    if (!timerActive) return;
    
    const accuracy = position.coords.accuracy;
    const rawSpeed = position.coords.speed ? position.coords.speed * 3.6 : 0;
    
    if (accuracy > 30) {
        updateValidationStatus('warning', `GPS impreciso (±${accuracy.toFixed(0)}m)`);
        return;
    }
    
    let finalSpeed = rawSpeed;
    
    if (finalSpeed > CONFIG.APP.MAX_SPEED) {
        updateValidationStatus('error', `Velocidade impossível (${finalSpeed.toFixed(0)} km/h)`);
        return;
    }
    
    if (finalSpeed < CONFIG.APP.MIN_SPEED) {
        finalSpeed = 0;
    }
    
    updateSpeedDisplay(finalSpeed);
    
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
    
    clearInterval(timerInterval);
    if (gpsWatch) navigator.geolocation.clearWatch(gpsWatch);
    
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    
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
    
    const minutes = elapsedTime / 60000;
    const distanceKm = totalDistance / 1000;
    const avgSpeed = minutes > 0 ? distanceKm / (minutes / 60) : 0;
    
    let isValid = true;
    let validationMessage = '';
    
    if (maxSpeed > CONFIG.APP.MAX_SPEED) {
        isValid = false;
        validationMessage = 'Velocidade máxima acima do limite';
    } else if (avgSpeed > 60) {
        isValid = false;
        validationMessage = 'Velocidade média suspeita';
    } else if (totalDistance < 100) {
        isValid = false;
        validationMessage = 'Distância muito curta';
    }
    
    const points = isValid ? calculatePoints(elapsedTime, totalDistance, avgSpeed) : 0;
    
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
    
    rideHistory.push(ride);
    saveRideHistory();
    
    if (isValid && points > 0) {
        currentUser.points += points;
        saveUserData();
        updateUserInterface();
    }
    
    if (isValid) {
        showToast(`✅ Descida registrada! ${points} pontos | ${formatTime(elapsedTime)}`, 'success');
    } else {
        showToast(`⚠️ ${validationMessage}`, 'error');
    }
    
    updateMyRides();
    loadRanking();
    
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
// SISTEMA DE PAGAMENTO PIX REAL
// ========================
function buyPro() {
    if (!currentUser) {
        showToast('Faça login primeiro!', 'error');
        showLoginScreen();
        return;
    }
    
    if (isProUser) {
        showToast('Você já é PRO!', 'info');
        return;
    }
    
    document.getElementById('paymentModal').style.display = 'flex';
    selectPayment('pix');
}

function selectPayment(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
    
    const details = document.getElementById('paymentDetails');
    
    if (method === 'pix') {
        paymentCode = "ARS" + Date.now().toString().slice(-8);
        
        details.innerHTML = `
            <div style="background: rgba(0, 184, 148, 0.1); padding: 20px; border-radius: 10px; margin: 15px 0;">
                <h4><i class="fas fa-qrcode"></i> PAGAMENTO PIX</h4>
                
                <div style="background: white; padding: 20px; border-radius: 10px; margin: 15px 0; text-align: center;">
                    <p style="color: black; font-size: 1.5rem; font-weight: bold; margin-bottom: 20px;">
                        Valor: <span style="color: #00b894;">R$ ${CONFIG.SEUS_DADOS.valor.toFixed(2)}</span>
                    </p>
                    
                    <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                        <p style="color: #333; margin-bottom: 15px; font-weight: bold;">
                            <i class="fas fa-key"></i> SUA CHAVE PIX:
                        </p>
                        <div id="pixKey" style="background: #000; color: #fff; padding: 15px; border-radius: 10px; font-family: monospace; font-size: 0.95rem; word-break: break-all; margin: 10px 0;">
                            ${CONFIG.SEUS_DADOS.pix}
                        </div>
                        <div style="margin-top: 15px; color: #666; font-size: 0.9rem;">
                            <p><i class="fas fa-user"></i> Nome: ${CONFIG.SEUS_DADOS.nome}</p>
                            <p><i class="fas fa-university"></i> Banco: ${CONFIG.SEUS_DADOS.banco}</p>
                        </div>
                    </div>
                    
                    <div style="margin: 20px 0; padding: 20px; background: #e3f2fd; border-radius: 10px; border-left: 4px solid #2196f3;">
                        <p style="color: #1565c0; font-weight: bold; margin-bottom: 15px;">
                            <i class="fas fa-exclamation-circle"></i> CÓDIGO DO PAGAMENTO:
                        </p>
                        <div style="font-size: 2rem; font-weight: bold; color: #000; padding: 15px; background: #fff; border-radius: 8px; letter-spacing: 4px; margin: 10px 0;">
                            ${paymentCode}
                        </div>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                            Anote este código! Você precisará dele para enviar o comprovante.
                        </p>
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding: 20px; background: rgba(255, 159, 67, 0.1); border-radius: 10px;">
                    <h5 style="color: #ff9f43; margin-bottom: 15px;">
                        <i class="fas fa-list-ol"></i> PASSO A PASSO:
                    </h5>
                    <ol style="text-align: left; margin-left: 20px; color: #333; line-height: 1.6;">
                        <li><strong>Abra seu app de banco</strong> (Nubank, Inter, Itaú, etc.)</li>
                        <li><strong>Toque em "PIX" ou "Pagar com PIX"</strong></li>
                        <li><strong>Cole a chave PIX</strong> (cópia automática ao clicar no botão abaixo)</li>
                        <li><strong>Digite o valor</strong>: R$ ${CONFIG.SEUS_DADOS.valor.toFixed(2)}</li>
                        <li><strong>Confirme o pagamento</strong></li>
                        <li><strong>Anote o código</strong>: <span style="font-weight: bold; color: #e84118;">${paymentCode}</span></li>
                        <li><strong>Envie o comprovante</strong> pelo WhatsApp (botão abaixo)</li>
                    </ol>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 25px;">
                    <a href="https://wa.me/${CONFIG.SEUS_DADOS.whatsapp}?text=Olá!%20Acabei%20de%20pagar%20o%20PRO%20do%20Ares%20Speed%20-%20Código:%20${paymentCode}%20-%20Valor:%20R$${CONFIG.SEUS_DADOS.valor.toFixed(2)}%20-%20Usuário:%20${currentUser.email}"
                       target="_blank"
                       class="btn btn-success"
                       style="padding: 15px; font-size: 1.1rem;">
                        <i class="fab fa-whatsapp"></i> Enviar Comprovante
                    </a>
                    
                    <button class="btn btn-primary" onclick="copyPixInfo()" style="padding: 15px; font-size: 1.1rem;">
                        <i class="fas fa-copy"></i> Copiar Chave PIX
                    </button>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(0, 0, 0, 0.1); border-radius: 8px;">
                    <p style="color: #666; font-size: 0.85rem; text-align: center;">
                        <i class="fas fa-info-circle"></i> Após enviar o compprovante, seu PRO será ativado em até 24 horas.<br>
                        Você receberá um email de confirmação.
                    </p>
                </div>
            </div>
        `;
        
        // Copia automaticamente a chave PIX
        setTimeout(copyPixInfo, 500);
        
    } else if (method === 'card') {
        details.innerHTML = `
            <div style="background: rgba(108, 92, 231, 0.1); padding: 20px; border-radius: 10px; margin: 15px 0;">
                <h4><i class="fas fa-credit-card"></i> CARTÃO DE CRÉDITO</h4>
                <p style="color: #666; margin: 15px 0;">
                    Em breve! Estamos habilitando pagamento por cartão.
                </p>
                <div style="padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; margin-top: 15px;">
                    <p style="color: #ff9f43; font-weight: bold;">
                        <i class="fas fa-lightbulb"></i> Use PIX para pagamento imediato!
                    </p>
                    <button class="btn btn-primary" onclick="selectPayment('pix')" style="margin-top: 10px; width: 100%;">
                        <i class="fas fa-qrcode"></i> Pagar com PIX
                    </button>
                </div>
            </div>
        `;
    }
}

function copyPixInfo() {
    const textToCopy = CONFIG.SEUS_DADOS.pix;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('✅ Chave PIX copiada! Cole no seu app de banco.', 'success');
        
        // Mostra confirmação visual
        const pixKeyElement = document.getElementById('pixKey');
        if (pixKeyElement) {
            pixKeyElement.style.background = '#00b894';
            pixKeyElement.style.color = '#fff';
            setTimeout(() => {
                pixKeyElement.style.background = '#000';
            }, 1000);
        }
    }).catch(err => {
        showToast('❌ Erro ao copiar. Anote manualmente: ' + textToCopy, 'error');
    });
}

function processPayment() {
    if (!currentUser) {
        showToast('Faça login primeiro!', 'error');
        return;
    }
    
    if (!paymentCode) {
        showToast('Selecione uma forma de pagamento primeiro', 'error');
        return;
    }
    
    const btn = document.getElementById('confirmPaymentBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
    
    // NÃO ATIVA AUTOMATICAMENTE!
    // Usuário precisa enviar comprovante
    
    showToast('⚠️ NÃO ATIVE AUTOMATICAMENTE!', 'warning');
    showToast(`Use o código ${paymentCode} ao enviar o comprovante`, 'info');
    
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-lock"></i> Confirmar Pagamento';
        
        // Mostra mensagem final
        document.getElementById('paymentDetails').innerHTML += `
            <div style="margin-top: 20px; padding: 20px; background: rgba(232, 65, 24, 0.1); border-radius: 10px; border-left: 4px solid #e84118;">
                <h5 style="color: #e84118;">
                    <i class="fas fa-exclamation-triangle"></i> ATENÇÃO
                </h5>
                <p style="color: #333;">
                    <strong>Não clique em "Já paguei" para teste!</strong><br>
                    Este é um sistema real de pagamento.<br>
                    Seu PRO só será ativado após envio do comprovante.
                </p>
                <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                    Código do pagamento: <strong>${paymentCode}</strong><br>
                    Envie para: ${CONFIG.SEUS_DADOS.whatsapp}
                </p>
            </div>
        `;
    }, 1500);
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('paymentDetails').innerHTML = '';
    paymentCode = "";
}

// ========================
// SISTEMA PARA VOCÊ ATIVAR MANUALMENTE (ADMIN)
// ========================
function activateProManually(userEmail, paymentCode) {
    // Esta função é para VOCÊ usar no console do navegador
    // Quando receber um comprovante, execute no console:
    
    console.log(`
    🛠️ PARA ATIVAR MANUALMENTE UM USUÁRIO PRO:
    
    1. Abra o console do navegador (F12)
    2. Cole este código:
    
    // Encontra o usuário pelo email
    const users = JSON.parse(localStorage.getItem('ares_users') || '[]');
    const user = users.find(u => u.email === "${userEmail}");
    
    if (user) {
        // Marca como PRO
        localStorage.setItem(\`ares_pro_\${user.id}\`, 'true');
        
        // Recarrega a página do usuário ou notifica ele
        console.log('✅ Usuário ${userEmail} agora é PRO!');
        
        // Você pode enviar email ou WhatsApp para o usuário
        alert('PRO ativado para ${userEmail}');
    } else {
        console.log('❌ Usuário não encontrado');
    }
    `);
}

// ========================
// GOOGLE ADSENSE
// ========================
function initAds() {
    updateAds();
    setInterval(updateAds, CONFIG.APP.AD_REFRESH_TIME);
}

function updateAds() {
    if (!currentUser) {
        hideAds();
        return;
    }
    
    if (isProUser) {
        hideAds();
        document.body.classList.add('pro-user');
    } else {
        showAds();
        document.body.classList.remove('pro-user');
    }
}

function showAds() {
    document.querySelectorAll('.ad-container').forEach(container => {
        container.style.display = 'flex';
        
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
    document.querySelectorAll('.ad-container').forEach(container => {
        container.style.display = 'none';
    });
}

// ========================
// INTERFACE DO USUÁRIO
// ========================
function updateUserInterface() {
    if (!currentUser) return;
    
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userStatus').textContent = isProUser ? 'PRO' : 'FREE';
    document.getElementById('userStatus').className = isProUser ? 'status pro' : 'status free';
    
    const avatar = document.getElementById('userAvatar');
    const initials = currentUser.name.charAt(0).toUpperCase();
    const bgColor = isProUser ? 'ff9f43' : '6c5ce7';
    avatar.src = `https://ui-avatars.com/api/?name=${initials}&background=${bgColor}&color=fff&bold=true`;
    avatar.alt = `Avatar ${currentUser.name}`;
    
    const proBtn = document.getElementById('proBtn');
    if (isProUser) {
        proBtn.innerHTML = '<i class="fas fa-crown"></i> VOCÊ É PRO!';
        proBtn.disabled = true;
        proBtn.style.opacity = '0.7';
    } else {
        proBtn.innerHTML = `<i class="fas fa-bolt"></i> VIRAR PRO - R$ ${CONFIG.APP.PRO_PRICE.toFixed(2)}`;
        proBtn.disabled = false;
        proBtn.style.opacity = '1';
    }
}

function showSection(section) {
    document.querySelectorAll('.nav-btn').forEach(btn
