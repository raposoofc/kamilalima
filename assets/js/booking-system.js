// ./assets/js/booking-system.js

// Adicione esta linha no topo
const API_BASE_URL = 'http://kamilalima.vercel.app/api'; 
// ATENÇÃO: Usaremos 'localhost' por enquanto.

const state = {
    currentStep: 1,
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    services: {
        'corte': { name: 'Corte de Cabelo', duration: 45 },
        'escova': { name: 'Escova Simples', duration: 30 },
        'manicure': { name: 'Manicure + Pedicure', duration: 60 },
        'coloracao': { name: 'Coloração', duration: 90 }
    },
    // Formato: 'YYYY-MM-DD': [{start: 'HH:MM', end: 'HH:MM'}, ...]
    unavailableTimes: {}, 
    // Configuração de funcionamento do salão
    openingTime: 9 * 60, // 09:00 em minutos (9 * 60)
    closingTime: 18 * 60, // 18:00 em minutos (18 * 60)
    interval: 30 // Intervalo de agendamento em minutos
};

/**
 * Funções Auxiliares
 */

// Função auxiliar para converter HH:MM ou HH:MM:SS em minutos (09:00 -> 540)
function timeToMinutes(timeString) {
    // Pega apenas HH e MM
    const parts = timeString.substring(0, 5).split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    return h * 60 + m;
}

/**
 * Funções de Comunicação com a API 
 */
async function fetchUnavailableTimes() {
    try {
        const response = await fetch(`${API_BASE_URL}/horarios-indisponiveis`);
        
        if (!response.ok) {
            throw new Error(`Falha ao buscar horários: ${response.status}`);
        }

        const data = await response.json();
        
        // Formata os dados para o frontend (agora inclui a hora de fim)
        const newUnavailableTimes = {};
        data.forEach(booking => {
            const date = booking.data;      
            // Pega apenas HH:MM (removendo :SS que pode vir do MySQL TIME)
            const timeStart = booking.hora_inicio.substring(0, 5); 
            const timeEnd = booking.hora_fim.substring(0, 5);       
            
            if (!newUnavailableTimes[date]) {
                newUnavailableTimes[date] = [];
            }
            // Armazenamos o objeto completo de INÍCIO e FIM para a lógica de sobreposição
            newUnavailableTimes[date].push({
                start: timeStart,
                end: timeEnd
            });
        });
        
        state.unavailableTimes = newUnavailableTimes;
        // console.log('Horários indisponíveis (por intervalo) carregados:', state.unavailableTimes);

    } catch (error) {
        console.error('Erro fatal ao buscar horários:', error);
    }
}

// --- FUNÇÃO DE INICIALIZAÇÃO DO SCRIPT ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Configura a data mínima no input para hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-input').min = today;

    // 2. BUSCA OS HORÁRIOS DO BACKEND ANTES DE TUDO
    await fetchUnavailableTimes();

    // 3. Adiciona listeners de eventos
    document.getElementById('service-select').addEventListener('change', handleServiceChange);
    document.getElementById('date-input').addEventListener('change', handleDateChange);
    document.getElementById('client-name').addEventListener('input', checkStep3Validity); 
    document.getElementById('booking-form').addEventListener('submit', submitBooking);

    // 4. Inicializa o estado visual
    updateStepDisplay();
});

/**
 * Funções de Navegação e Controle de Passo
 */
function updateStepDisplay() {
    document.querySelectorAll('.booking-step').forEach(step => {
        step.classList.remove('active');
    });
    const activeStepElement = document.getElementById(`step-${state.currentStep}`);
    if (activeStepElement) {
        activeStepElement.classList.add('active');
    }
}

function nextStep(step) {
    state.currentStep = step;
    updateStepDisplay();
}

function prevStep(step) {
    state.currentStep = step;
    updateStepDisplay();
}

function resetBooking() {
    state.currentStep = 1;
    state.selectedService = null;
    state.selectedDate = null;
    state.selectedTime = null;
    document.getElementById('booking-form').reset();
    document.getElementById('time-slots').innerHTML = '<p>Selecione uma data para ver os horários disponíveis.</p>';
    document.getElementById('next-step-1').disabled = true; 
    document.getElementById('next-step-2').disabled = true; 
    updateStepDisplay();
}

/**
 * Funções de Validação e Dados
 */
function handleServiceChange(event) {
    const serviceKey = event.target.value;
    state.selectedService = state.services[serviceKey];
    // Habilita/Desabilita o botão Próximo do Passo 1
    document.getElementById('next-step-1').disabled = !state.selectedService;
    // Se já havia uma data selecionada, recalcula os slots com o novo serviço
    if(state.selectedDate) {
        generateTimeSlots(state.selectedDate);
    }
}

function handleDateChange(event) {
    state.selectedDate = event.target.value;
    document.getElementById('next-step-2').disabled = true;
    state.selectedTime = null; // Reseta a hora ao mudar a data
    generateTimeSlots(state.selectedDate);
}

// 🛑 FUNÇÃO CHAVE COM A LÓGICA DE BLOQUEIO POR DURAÇÃO (CORRIGIDA)
function generateTimeSlots(dateString) {
    const slotsContainer = document.getElementById('time-slots');
    slotsContainer.innerHTML = '';
    
    if (!state.selectedService) {
        slotsContainer.innerHTML = '<p>Selecione um serviço primeiro.</p>';
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const isToday = dateString === today;
    const nowMinutes = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : 0;
    
    let time = state.openingTime;
    const serviceDuration = state.selectedService.duration;
    
    // Horários de início/fim aprovados para a data
    const approvedBookings = state.unavailableTimes[dateString] || []; 
    let hasSlots = false;

    // Cabeçalho da área de horários
    const timeHeader = document.createElement('h3');
    timeHeader.textContent = 'Horários Disponíveis (Clique para selecionar)';
    slotsContainer.appendChild(timeHeader);

    const grid = document.createElement('div');
    grid.classList.add('time-grid');

    // Itera por intervalos de 30 minutos (state.interval)
    while (time + state.interval <= state.closingTime) { 
        const startMinutes = time;
        const endMinutes = time + serviceDuration; // Fim do NOVO agendamento
        
        const hour = Math.floor(startMinutes / 60).toString().padStart(2, '0');
        const minute = (startMinutes % 60).toString().padStart(2, '0');
        const slot = `${hour}:${minute}`;
        
        // 1. Verifica se o slot já passou (se for hoje)
        if (isToday && startMinutes < nowMinutes) {
            time += state.interval;
            continue;
        }

        // 2. Verifica se o agendamento de serviço cabe
        if (endMinutes > state.closingTime) {
             time += state.interval;
             continue; // Não há tempo suficiente para completar o serviço
        }
        
        let isTimeAvailable = true;
        
        // 3. Lógica de Sobreposição: Verifica se o NOVO agendamento conflita com algum APROVADO
        for (const booking of approvedBookings) {
            const approvedStart = timeToMinutes(booking.start);
            const approvedEnd = timeToMinutes(booking.end); 
            
            // Ocupado se o intervalo do novo agendamento (startMinutes a endMinutes)
            // se sobrepõe ao intervalo do agendamento aprovado (approvedStart a approvedEnd)
            if (startMinutes < approvedEnd && endMinutes > approvedStart) {
                isTimeAvailable = false;
                break; 
            }
        }

        // 4. Cria o botão
        if (isTimeAvailable) {
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('time-slot-btn');
            button.textContent = slot;
            button.dataset.time = slot;
            button.addEventListener('click', selectTimeSlot);
            grid.appendChild(button);
            hasSlots = true;
        } else {
            // Se indisponível
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('time-slot-btn', 'unavailable');
            button.textContent = `${slot} (Ocupado)`;
            button.disabled = true;
            grid.appendChild(button);
            hasSlots = true; 
        }
        
        time += state.interval; // Passa para o próximo intervalo (30 minutos)
    }
    
    slotsContainer.appendChild(grid);

    if (!hasSlots && slotsContainer.children.length === 1) { 
        slotsContainer.innerHTML = '<p class="no-slots-message">Nenhum horário disponível nesta data. Tente outra.</p>';
    }
}


function selectTimeSlot(event) {
    // Remove a classe 'selected' de todos os botões de horário
    document.querySelectorAll('.time-slot-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Adiciona a classe 'selected' ao botão clicado
    event.target.classList.add('selected');
    state.selectedTime = event.target.dataset.time;
    
    // Habilita o botão de "Próximo"
    document.getElementById('next-step-2').disabled = false;
    
    // Atualiza o resumo
    updateSummary();
}

function updateSummary() {
    if (state.selectedService && state.selectedDate && state.selectedTime) {
        document.getElementById('summary-service').textContent = state.selectedService.name;
        
        // Formata a data para visualização (DD/MM/YYYY)
        const [year, month, day] = state.selectedDate.split('-');
        document.getElementById('summary-date').textContent = `${day}/${month}/${year}`;
        
        document.getElementById('summary-time').textContent = state.selectedTime;
    }
    checkStep3Validity(); // Garante que o botão de submit está correto
}

function checkStep3Validity() {
    const nameInput = document.getElementById('client-name');
    const submitButton = document.getElementById('submit-booking');
    
    const isNameValid = nameInput.value.trim().length > 0;
    const isBookingReady = state.selectedService && state.selectedDate && state.selectedTime;
    
    submitButton.disabled = !(isNameValid && isBookingReady);
}

/**
 * Funções de Envio
 */
async function submitBooking(event) {
    event.preventDefault(); // Impedir o envio padrão do formulário

    const clientName = document.getElementById('client-name').value;
    const clientWhatsapp = document.getElementById('client-whatsapp').value;
    
    const service = state.selectedService;
    const date = state.selectedDate; // Formato YYYY-MM-DD
    const time = state.selectedTime; // Formato HH:MM
    
    // 1. Calcular a Hora de Fim do Serviço
    const [startHour, startMinute] = time.split(':').map(Number);
    const totalMinutes = (startHour * 60) + startMinute + service.duration;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    
    const horaFim = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    // 2. Montar os dados para o Backend
    const bookingData = {
        cliente_nome: clientName,
        cliente_whatsapp: clientWhatsapp,
        servico_nome: service.name,
        data_agendamento: date,
        hora_inicio: time,
        hora_fim: horaFim // Enviamos a hora_fim calculada
    };

    try {
        // 3. Enviar dados para a API (POST)
        const response = await fetch(`${API_BASE_URL}/agendamentos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (response.status === 201) {
            // Agendamento Salvo com status 'PENDENTE'
            
            // CRIAÇÃO DO LINK DE APROVAÇÃO (USA O ID RETORNADO)
            const approvalLink = `http://127.0.0.1:5000/api/agendamentos/${result.id}/aprovar`;

            // CORREÇÃO FINAL: Usando a variável approvalLink na mensagem
            const whatsappMessage = 
                `Olá Kamila Lima! NOVO AGENDAMENTO PENDENTE (ID: ${result.id}). Por favor, APROVE para bloquear o horário:\n\n` +
                `💅 Serviço: *${service.name}*\n` +
                `🗓 Data: *${document.getElementById('summary-date').textContent}*\n` +
                `⏰ Horário: *${time}*\n` +
                `👤 Cliente: *${clientName}* (${clientWhatsapp})\n\n` +
                `👉 **CLIQUE PARA APROVAR ESTE AGENDAMENTO:** ${approvalLink}`; // Link dinâmico

            const whatsappLink = 
                `https://api.whatsapp.com/send?phone=5582988334997&text=${encodeURIComponent(whatsappMessage)}`;
            
            // 4. Exibir sucesso
            document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));
            document.getElementById('confirmation-message').classList.add('active');
            
            // 5. Redireciona para o WhatsApp após um pequeno atraso
            setTimeout(() => {
                window.open(whatsappLink, '_blank');
            }, 1500);

        } else {
            alert(`Erro ao agendar: ${result.erro || 'Erro desconhecido.'}`);
        }

    } catch (error) {
        console.error('Erro na comunicação com o backend:', error);
        alert('Erro de conexão. Verifique se o servidor local está rodando.');
    }

    return false;
}