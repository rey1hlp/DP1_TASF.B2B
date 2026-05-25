# Documentacion del sistema (backend + frontend)

## Resumen
Este proyecto implementa una simulacion de periodos para una red de envios aereos. El backend prepara la ventana de simulacion, ejecuta el algoritmo y publica los resultados via WebSocket. El frontend consume esos datos, renderiza el mapa, controla la simulacion y muestra indicadores de estado.

## Arquitectura general
- Backend (Spring): carga datos, ejecuta el algoritmo GA, prepara segmentos de vuelo y eventos de almacenes, publica ticks por WebSocket.
- Frontend (React + Vite + Leaflet): inicia simulacion, escucha WebSocket, renderiza mapa, controla pausa/reanudar, y aplica rangos de semaforo.

## Backend

### Flujo principal
1. API inicia simulacion con parametros (fecha inicio, dias, etc.).
2. Se cargan aeropuertos, envios y planes de vuelo.
3. Se ejecuta el algoritmo GA para asignar rutas.
4. Se construyen segmentos de vuelo y eventos de almacen.
5. Se publica un mensaje init por WebSocket y luego ticks de tiempo.

### Componentes clave
- SimulationController: expone POST /api/simulations/ga para iniciar simulacion.
- SimulationService: orquesta la ejecucion, carga datos y genera resultados.
- SimulationRegistry: administra sesiones WebSocket, ticks, pausa/reanudar y estado.
- SimulationWebSocketHandler: registra sesiones y recibe comandos de control.

### Datos principales
- FlightSegmentDto: segmento de vuelo con horario y carga, incluye capacidad.
- WarehouseStatusDto / WarehouseEventDto: eventos de ocupacion por aeropuerto.
- SimulationInitMessage: payload inicial con vuelos y eventos de almacen.
- SimulationTickMessage: minuto de simulacion.
- SimulationStatusMessage: estado (READY, PAUSED, FAILED, COMPLETED).

### WebSocket
- URL: ws://<host>/ws/sim?simId=<id>
- Mensajes
  - init: metadatos y listas de vuelos/almacenes.
  - tick: minuto actual de simulacion.
  - status: READY, PAUSED, FAILED, COMPLETED.
- Control desde frontend
  - { "type": "control", "action": "pause" }
  - { "type": "control", "action": "resume" }

### Rendimiento y reloj
- TICK_MS = 500ms.
- speedMinPerSec configurable (ej. 20 min/seg).
- El tick usa milisegundos reales para reflejar la tasa de refresco.

## Frontend

### Flujo principal
1. Inicia simulacion enviando parametros al backend.
2. Abre WebSocket con simId recibido.
3. Muestra popup de calculo inicial hasta que llegan ticks.
4. Renderiza vuelos en mapa y actualiza por ticks.
5. Permite pausar y reanudar la simulacion.

### Componentes clave
- App: estado global de simulacion, filtros de ventana y reinicio.
- SimulationControls: fecha, dias, rangos semaforo, iniciar/pausar.
- SimulationStatus: fecha/hora y estados (preparando, pausado).
- MapView: mapa Leaflet, aviones en movimiento, aeropuertos con semaforo.

### Semaforo y almacenes
- El backend envia eventos de ocupacion por aeropuerto.
- El frontend calcula ocupacion por minuto y pinta:
  - Verde: <= greenMax
  - Ambar: <= amberMax
  - Rojo: > amberMax

### Pausa y reanudar
- Boton Pausar envia comando WS.
- Boton Reanudar reanuda ticks.
- La UI muestra "Simulacion pausada" en la cabecera.

### Reseteo limpio
- Al completar la simulacion, se limpian datos de sesion para iniciar otra.

## Configuracion y ejecucion (resumen)
- Backend: Spring Boot.
- Frontend: Vite + React.
- El frontend consume /api/airports y /api/simulations/ga.

## Limitaciones conocidas
- Algunas metricas del panel son estaticas y pueden conectarse a resultados reales.
- El resumen final depende del estado local y del backend.

## Notas de datos
- La distribucion geografica depende de los envios cargados.
- Si no hay envios en America, no se veran vuelos en esa region.
