// ./assets/js/booking-system.js

// REMOÇÃO DA API_BASE_URL e das chamadas ao Backend
// O script agora constrói a mensagem do WhatsApp diretamente no frontend.

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
    // Removido o 'unavailableTimes' e a lógica de horários ocupados.
    
    // Configuração de funcionamento do salão (ainda necessária para gerar slots)
    openingTime: 9 * 60, // 09:00 em minutos (9 * 60)
    closingTime: 18 * 60, // 18:00 em minutos (18 * 60)
    interval: 30 // Intervalo de agendamento em minutos
};

/**
 * Funções Auxiliares (mantidas para geração de horários)
 */

// Função auxiliar para converter HH:MM ou HH:MM:SS em minutos
function timeToMinutes(timeString) {
    // Pega apenas HH e MM
    const parts = timeString.substring(0, 5).split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    return h * 60 + m;
}

/**
 * Funções de Comunicação com a API (REMOVIDAS OU SIMPLIFICADAS)
 */
// A função fetchUnavailableTimes é removida, pois não buscamos mais do backend.

// --- FUNÇÃO DE INICIALIZAÇÃO DO SCRIPT ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configura a data mínima no input para hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-input').min = today;

    // 2. BUSCA DE HORÁRIOS REMOVIDA
    // await fetchUnavailableTimes();

    // 3. Adiciona listeners de eventos
    document.getElementById('service-select').addEventListener('change', handleServiceChange);
    document.getElementById('date-input').addEventListener('change', handleDateChange);
    document.getElementById('client-name').addEventListener('input', checkStep3Validity); 
    // O listener de submit chama agora a função simplificada:
    document.getElementById('booking-form').addEventListener('submit', submitBooking);

    // 4. Inicializa o estado visual
    updateStepDisplay();
});

/**
 * Funções de Navegação e Controle de Passo (mantidas)
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
 * Funções de Validação e Dados (mantidas)
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

// 🛑 FUNÇÃO CHAVE: SIMPLIFICADA PARA APENAS GERAR TODOS OS SLOTS VÁLIDOS (SEM VERIFICAÇÃO DE OCUAPÇÃO)
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

        // 2. Verifica se o agendamento de serviço cabe (dura até o fechamento)
        if (endMinutes > state.closingTime) {
             time += state.interval;
             continue; // Não há tempo suficiente para completar o serviço
        }
        
        // REMOVIDA a Lógica de Sobreposição, pois não há BD para consultar horários ocupados
        
        // 3. Cria o botão (todos os horários válidos são tratados como disponíveis)
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('time-slot-btn');
        button.textContent = slot;
        button.dataset.time = slot;
        button.addEventListener('click', selectTimeSlot);
        grid.appendChild(button);
        hasSlots = true;
        
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
 * Funções de Envio (SIMPLIFICADA PARA WHATSAPP)
 */
async function submitBooking(event) {
    event.preventDefault(); // Impedir o envio padrão do formulário (sempre preventDefault no submit)

    const clientName = document.getElementById('client-name').value.trim();
    const clientWhatsapp = document.getElementById('client-whatsapp').value.trim();
    
    const service = state.selectedService;
    const time = state.selectedTime;
    
    // 1. Validação final
    if (!service || !state.selectedDate || !time || !clientName) {
        alert('Erro interno de validação. Recarregue a página.');
        return;
    }

    // 2. Definir a Mensagem e Link do WhatsApp
    // Como não há backend, não há ID nem link de aprovação.
    
    const whatsappMessage = 
        `Olá Kamila Lima!\n\n` +
        `*SOLICITAÇÃO DE AGENDAMENTO*\n\n` +
        `Por favor, confirme se o horário que estou solicitando está livre.\n\n` +
        `💅 Serviço: *${service.name}*\n` +
        `🗓 Data: *${document.getElementById('summary-date').textContent}*\n` +
        `⏰ Horário: *${time}*\n` +
        `👤 Cliente: *${clientName}* (WhatsApp: ${clientWhatsapp})\n\n` +
        `⚠️ ATENÇÃO: Confirme este agendamento manualmente!`;
        
    const whatsappLink = 
        `https://api.whatsapp.com/send?phone=5582988334997&text=${encodeURIComponent(whatsappMessage)}`;
    
    // 3. Exibir sucesso
    document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));
    document.getElementById('confirmation-message').classList.add('active');
    
    // 4. Redireciona para o WhatsApp após um pequeno atraso
    setTimeout(() => {
        window.open(whatsappLink, '_blank');
    }, 1500); // Aguarda 1.5s para o cliente ver a mensagem de sucesso

    // Sem comunicação com API, sem bloco try/catch para erros de rede.
}