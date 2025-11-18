from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS # Importamos CORS para permitir a comunicação com o frontend

# --- CONFIGURAÇÃO DO BANCO DE DADOS (AJUSTE AQUI) ---
DB_CONFIG = {
    'host': 'localhost',      
    'user': 'root',           
    'password': 'M@aria2014',  # SUA SENHA DO MYSQL
    'database': 'kamilalima_agendamentos'
}

app = Flask(__name__)
# Configura CORS para permitir requisições do seu frontend local (file:///) e http://127.0.0.1
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

# Função para conectar ao banco de dados
def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"Erro ao conectar ao MySQL: {err}")
        return None

# --- ROTA DE TESTE ---
@app.route('/', methods=['GET'])
def index():
    return "API do Agendamento Kamila Lima está funcionando!"

# --- ROTA PARA BUSCAR HORÁRIOS JÁ AGENDADOS (BUSCA POR INTERVALO E SÓ APROVADOS) ---
@app.route('/api/horarios-indisponiveis', methods=['GET'])
def get_indisponiveis():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"erro": "Falha na conexão com o banco de dados"}), 500

    cursor = conn.cursor(dictionary=True)

    # 🛑 MUDANÇA CRÍTICA: Busca hora_inicio e hora_fim, APENAS status APROVADO
    query = """
    SELECT data_agendamento, hora_inicio, hora_fim
    FROM agendamentos 
    WHERE status = 'APROVADO' 
    """
    
    try:
        cursor.execute(query)
        horarios = cursor.fetchall()
        
        horarios_formatados = []
        for h in horarios:
            horarios_formatados.append({
                'data': h['data_agendamento'].strftime('%Y-%m-%d'),
                'hora_inicio': str(h['hora_inicio']),
                'hora_fim': str(h['hora_fim']) # NOVO CAMPO RETORNADO
            })
            
        return jsonify(horarios_formatados), 200
        
    except mysql.connector.Error as err:
        return jsonify({"erro": f"Erro na consulta SQL: {err}"}), 500
        
    finally:
        cursor.close()
        conn.close()

# --- ROTA SECRETA PARA KAMILA LIMA APROVAR O AGENDAMENTO ---
@app.route('/api/agendamentos/<int:booking_id>/aprovar', methods=['GET'])
def aprovar_agendamento(booking_id):
    conn = get_db_connection()
    if conn is None:
        return "Erro: Falha na conexão com o banco de dados", 500

    cursor = conn.cursor()
    # Query para atualizar o status do agendamento
    query = "UPDATE agendamentos SET status = 'APROVADO' WHERE id = %s"
    
    try:
        cursor.execute(query, (booking_id,))
        conn.commit()
        
        # Resposta amigável em HTML para a Kamila ver no navegador
        return f"""
        <!DOCTYPE html>
        <html>
        <head><title>Agendamento Aprovado</title>
        <style>
        body {{ background-color: #F7ECE0; font-family: sans-serif; text-align: center; padding-top: 50px; }}
        .container {{ max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }}
        h1 {{ color: #28A745; }}
        </style>
        </head>
        <body>
        <div class="container">
            <h1>✅ Agendamento ID {booking_id} Aprovado com Sucesso!</h1>
            <p>Este horário agora está **BLOQUEADO** no site para novos clientes.</p>
        </div>
        </body>
        </html>
        """, 200
        
    except mysql.connector.Error as err:
        conn.rollback()
        return f"Erro ao aprovar o agendamento: {err}", 500
        
    finally:
        cursor.close()
        conn.close()

# --- ROTA PARA RECEBER E SALVAR UM NOVO AGENDAMENTO ---
@app.route('/api/agendamentos', methods=['POST'])
def criar_agendamento():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"erro": "Falha na conexão com o banco de dados"}), 500

    # 1. Obter dados JSON do frontend
    data = request.get_json()
    
    # 2. Extrair e validar dados
    required_fields = ['cliente_nome', 'cliente_whatsapp', 'servico_nome', 'data_agendamento', 'hora_inicio', 'hora_fim']
    if not all(field in data for field in required_fields):
        return jsonify({"erro": "Dados incompletos. Faltam campos obrigatórios."}), 400

    cliente_nome = data['cliente_nome']
    cliente_whatsapp = data['cliente_whatsapp']
    servico_nome = data['servico_nome']
    data_agendamento = data['data_agendamento']
    hora_inicio = data['hora_inicio']
    hora_fim = data['hora_fim'] # Recebemos a hora_fim calculada pelo JS

    # 3. Consulta SQL para Inserção (Status PENDENTE)
    query = """
    INSERT INTO agendamentos 
    (cliente_nome, cliente_whatsapp, servico_nome, data_agendamento, hora_inicio, hora_fim, status) 
    VALUES (%s, %s, %s, %s, %s, %s, 'PENDENTE')
    """
    values = (cliente_nome, cliente_whatsapp, servico_nome, data_agendamento, hora_inicio, hora_fim)
    
    cursor = conn.cursor()
    try:
        cursor.execute(query, values)
        conn.commit()
        
        # 4. Retorno de sucesso (Retorna o ID para o JS usar no link de aprovação)
        return jsonify({
            "mensagem": "Agendamento solicitado com sucesso. Aguardando aprovação.",
            "id": cursor.lastrowid,
            "status": "PENDENTE"
        }), 201
        
    except mysql.connector.Error as err:
        conn.rollback()
        print(f"Erro ao salvar agendamento: {err}")
        return jsonify({"erro": f"Erro interno ao processar o agendamento: {err}"}), 500
        
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)