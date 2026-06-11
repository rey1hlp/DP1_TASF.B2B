#!/bin/bash
 
# ====== CONFIGURACIÓN PUCP ======
DNS_PUCP="1inf54-984-7g.inf.pucp.edu.pe"
IP_PUCP="200.16.7.171"
USUARIO="1inf54.984.7g"
PASSWORD='R2eChjY7'
PUERTO_BACKEND="8080"
PROJECT_ROOT="$(pwd)"
 
echo "🚀 INICIANDO DEPLOY A PUCP CON PARCHE CORS AUTOMÁTICO..."
echo "🖥️ Destino: $DNS_PUCP ($IP_PUCP)"
 
# ===== 0. CREAR CARPETA EN VM =====
echo "📁 Creando carpeta en VM..."
export SSHPASS="$PASSWORD"
sshpass -e ssh -o StrictHostKeyChecking=no "$USUARIO@$DNS_PUCP" "mkdir -p /home/$USUARIO/app" 2>/dev/null

# ===== 1. COMPILAR BACKEND =====
echo ""
echo "⚙️ Compilando BACKEND..."
cd "$PROJECT_ROOT/backend_tasf_b2b/algoritmos"

# Parchear WebConfig (opcional)
sed -i 's/\.allowedOrigins("http:\/\/localhost:5173")/.allowedOriginPatterns("*")/' \
  src/main/java/com/tasf_b2b/planificador/api/WebConfig.java

./mvnw clean package -DskipTests -q
 
if [ $? -ne 0 ]; then
    echo "❌ Error en compilación del backend"
    exit 1
fi
 
# ===== 2. COMPILAR FRONTEND =====
echo "⚙️ Compilando FRONTEND..."
cd "$PROJECT_ROOT/frontend_tasf_b2b"

rm -rf dist

sed -i "s/VITE_API_BASE || /VITE_API_BASE ?? /g" src/services/api.ts

# Apuntamos las llamadas de la API a /api (Reverse Proxy local)
cat > .env << EOF
VITE_API_BASE=
EOF
npm install -q
npm run build -q
 
if [ $? -ne 0 ]; then
    echo "❌ Error en compilación del frontend"
    exit 1
fi
 
cd "$PROJECT_ROOT"
 
# ===== 3. EMPAQUETAR =====
echo "📦 Empaquetando archivos..."
tar -czf backend.tar.gz -C backend_tasf_b2b/algoritmos/target genetico-0.0.1-SNAPSHOT.jar
tar -czf frontend.tar.gz -C frontend_tasf_b2b dist
 
# ===== 4. INSTALAR SSHPASS (si no está) =====
if ! command -v sshpass &> /dev/null; then
    echo "📥 Instalando sshpass..."
    sudo apt-get install sshpass -y -qq
fi
 
# ===== 5. SUBIR A VM PUCP =====
echo "📤 Subiendo backend a PUCP..."
export SSHPASS="$PASSWORD"
sshpass -e scp -o StrictHostKeyChecking=no backend.tar.gz "$USUARIO@$DNS_PUCP:/home/$USUARIO/app/" 2>/dev/null
 
echo "📤 Subiendo frontend a PUCP..."
sshpass -e scp -o StrictHostKeyChecking=no frontend.tar.gz "$USUARIO@$DNS_PUCP:/home/$USUARIO/app/" 2>/dev/null
 
# ===== 6. DESPLEGAR EN VM =====
echo "🖥️ Desplegando en VM PUCP..."
 
# Crear script de despliegue
REMOTE_SCRIPT="/tmp/deploy_remote.sh"
cat > "$REMOTE_SCRIPT" << 'REMOTESCRIPT'
#!/bin/bash
cd /home/1inf54.984.7g/app
 
# Desempaquetar
tar -xzf backend.tar.gz
rm -rf dist
tar -xzf frontend.tar.gz
rm *.tar.gz
 
# Renombrar JAR
mv genetico-0.0.1-SNAPSHOT.jar genetico.jar
 
# Configurar systemd para el backend
sudo tee /etc/systemd/system/genetico.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Genetico Backend
After=network.target
 
[Service]
Type=simple
User=1inf54.984.7g
WorkingDirectory=/home/1inf54.984.7g/app
ExecStart=/usr/bin/java -jar /home/1inf54.984.7g/app/genetico.jar
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
 
[Install]
WantedBy=multi-user.target
SYSTEMD

# ===== Limpieza TOTAL de backends anteriores =====
echo "🧹 Eliminando procesos zombie del backend..."
# 1. Detener el servicio si existe (forma controlada)
sudo systemctl stop genetico 2>/dev/null || true
# 2. Matar cualquier proceso Java que esté corriendo el JAR antiguo
sudo pkill -f 'genetico.*\.jar' 2>/dev/null || true
# 3. Por si acaso, liberar el puerto 8080
sudo fuser -k 8080/tcp 2>/dev/null || true
# 4. Detener y deshabilitar Tomcat si lo hubiera
sudo systemctl stop tomcat10 2>/dev/null || true
sudo systemctl disable tomcat10 2>/dev/null || true
# 5. Pequeña pausa para que el SO recoja los procesos muertos
sleep 3
echo "✅ Sistema limpio. Ningún backend anterior debería estar corriendo."

# ===== Asegurar MySQL activo y limpio =====
sudo systemctl restart mysql
sleep 2

# Recargar systemd y reiniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable genetico
sudo systemctl restart genetico
 
# Desplegar frontend
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/

# --- RECONFIGURACIÓN FORZADA DE NGINX ---
sudo rm -f /etc/nginx/sites-available/default
sudo rm -f /etc/nginx/sites-enabled/default

# Inyectar la configuración limpia en sites-available con PARCHE CORS
sudo tee /etc/nginx/sites-available/default > /dev/null << 'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 1inf54-984-7g.inf.pucp.edu.pe;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name 1inf54-984-7g.inf.pucp.edu.pe;

    ssl_certificate /etc/letsencrypt/live/1inf54-984-7g.inf.pucp.edu.pe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1inf54-984-7g.inf.pucp.edu.pe/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ⭐ Límites para uploads grandes
    client_max_body_size 1000M;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'X-Requested-With,Accept,Content-Type,Origin,Authorization' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
            add_header 'Access-Control-Allow-Headers' 'X-Requested-With,Accept,Content-Type,Origin,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        # Soporte WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'X-Requested-With,Accept,Content-Type,Origin,Authorization' always;

        if ($request_method = 'OPTIONS') {
            # ... (opcional, igual que en /api)
        }

        # Soporte WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# Forzar enlace simbólico activo en sites-enabled
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
 
# Probar y reiniciar nginx
sudo nginx -t && sudo systemctl restart nginx
 
echo "✅ Deploy completado exitosamente con CORS desbloqueado"
REMOTESCRIPT
 
# Subir script de despliegue
sshpass -e scp -o StrictHostKeyChecking=no "$REMOTE_SCRIPT" "$USUARIO@$DNS_PUCP:/tmp/deploy_remote.sh" 2>/dev/null
 
# Ejecutar script en remoto
sshpass -e ssh -o StrictHostKeyChecking=no -t "$USUARIO@$DNS_PUCP" "bash /tmp/deploy_remote.sh" 2>/dev/null
 
# Limpiar script temporal
rm "$REMOTE_SCRIPT"
 
# ===== 7. LIMPIAR =====
rm backend.tar.gz frontend.tar.gz
unset SSHPASS
 
echo ""
echo "🎉 ¡DEPLOY COMPLETADO EXITOSAMENTE!"
echo ""
echo "📊 URLs:"
echo "   📱 Frontend:  http://$DNS_PUCP"
echo "   🔧 Backend:   http://$IP_PUCP:$PUERTO_BACKEND"
echo ""