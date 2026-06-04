# Operación Diaria: documentación técnica

## 1. Objetivo funcional

La pantalla de Operación Diaria muestra el estado operativo en tiempo real del día actual:

- vuelos activos y próximos,
- envíos registrados,
- ocupación de almacenes,
- alertas de saturación,
- mapa interactivo con aeropuertos y aeronaves.

La operación diaria no usa la misma lógica temporal que la simulación histórica. Aquí:

- `1 minuto en pantalla = 1 minuto real`,
- el estado del mapa debe avanzar de forma continua,
- cada cambio en envíos o cancelaciones debe disparar una replanificación inmediata.

## 2. Flujo general

### 2.1 Inicio de la pantalla

La vista principal es `frontend_tasf_b2b/src/pages/DailyOperationPage.tsx`.

Al cargar:

1. consulta aeropuertos con `fetchAirports()`,
2. pide un snapshot inicial a `GET /api/operation/daily`,
3. abre el WebSocket `GET /api/operation/daily/stream`,
4. actualiza la UI con cada snapshot recibido.

### 2.2 Construcción del snapshot

El backend arma el snapshot con `DailyOperationService`.

Archivo principal:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/sim/DailyOperationService.java`

Ese servicio construye:

- `segments`: vuelos activos o planificados,
- `warehouseSnapshot`: ocupación por aeropuerto,
- `shipmentSummary`: totales de envíos,
- `alerts`: alertas por ocupación alta.

### 2.3 Replanificación

La replanificación se dispara cuando:

- se crea un envío,
- se actualiza un envío y cambian campos relevantes,
- se importa un TXT masivo de envíos,
- se cancela un vuelo todavía no salido,
- se elimina una cancelación válida.

El motor de planificación se centraliza en:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/sim/DailyPlanningService.java`

## 3. Backend: arquitectura

### 3.1 Controladores

#### `OperationController`

Archivo:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/OperationController.java`

Expone:

- `GET /api/operation/daily`

Recibe filtros opcionales:

- `date`
- `airport`
- `window`

#### `ShipmentCrudController`

Archivo:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/ShipmentCrudController.java`

Responsabilidades:

- CRUD de envíos,
- importación masiva por TXT,
- disparo de replanificación después de cambios.

#### `FlightCancellationController`

Archivo:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/FlightCancellationController.java`

Responsabilidades:

- cancelar vuelo por día,
- eliminar cancelación por día,
- disparar replanificación condicional si el vuelo todavía no salió.

#### `DailyOperationStreamRegistry`

Archivo:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/ws/DailyOperationStreamRegistry.java`

Responsabilidades:

- registrar sesiones WebSocket,
- emitir snapshots periódicos,
- mantener sincronizada la vista.

### 3.2 Servicio de planificación

#### `DailyPlanningService`

Archivo:

- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/sim/DailyPlanningService.java`

Responsabilidades:

- resolver la ventana activa,
- cargar aeropuertos, vuelos y envíos desde BD,
- instanciar vuelos del día,
- quitar vuelos cancelados,
- ejecutar el GA,
- persistir el resultado en `daily_plan_run` y `daily_plan_segment`.

### 3.3 Persistencia

Tablas relevantes:

- `shipment`
- `flight`
- `daily_plan_run`
- `daily_plan_segment`
- `flight_day_cancellation`

La tabla `daily_plan_run` guarda el contexto de cada corrida:

- fecha del plan,
- minuto inicial de ventana,
- minuto final,
- tipo de disparador,
- detalle,
- totales.

La tabla `daily_plan_segment` guarda cada tramo del vuelo que quedó en el plan diario.

## 4. Modelo de tiempo

### 4.1 Regla funcional

En Operación Diaria:

- el reloj es el reloj real del sistema,
- no hay aceleración,
- no se extrapola la hora como en simulación,
- el avión debe moverse linealmente entre salida y llegada.

### 4.2 Implementación

El frontend usa:

- `frontend_tasf_b2b/src/pages/DailyOperationPage.tsx`

La función:

- `getCurrentMinuteOfDay(date)`

devuelve el minuto real del día actual.

El mapa consume ese minuto directamente, sin extrapolación desde el backend:

- esto evita saltos hacia atrás,
- evita desincronización entre minuto backend y minuto visual,
- mantiene el movimiento continuo.

## 5. Componentes de frontend

### 5.1 `DailyOperationPage`

Archivo:

- `frontend_tasf_b2b/src/pages/DailyOperationPage.tsx`

Es el orquestador de la pantalla:

- obtiene datos iniciales,
- escucha WebSocket,
- mantiene el estado de la UI,
- calcula métricas y listas de vuelos,
- pasa props al mapa y a los paneles laterales.

### 5.2 `MapView`

Archivo:

- `frontend_tasf_b2b/src/components/MapView.tsx`

Responsabilidad:

- pintar aeropuertos,
- pintar aeronaves activas,
- interpolar posición entre origen y destino,
- mostrar tooltips.

La posición del avión se calcula con:

- `progress = (currentMinute - salidaMin) / (llegadaMin - salidaMin)`

Si el minuto actual avanza de forma continua, el avión también.

### 5.3 CRUD de envíos

Archivo:

- `frontend_tasf_b2b/src/components/ShipmentsCrud.tsx`

Responsabilidades:

- listar envíos,
- crear/editar/borrar envíos,
- cargar TXT masivo con modal,
- refrescar la lista al terminar.

## 6. Importación masiva de envíos

### 6.1 Convención de archivo

El nombre debe seguir el patrón:

- `_envios_OACI_.txt`

Ejemplo:

- `_envios_EBCI_.txt`

Eso significa:

- origen fijo: `EBCI`
- destino variable: el OACI de cada línea.

### 6.2 Formato de línea

Cada línea debe tener:

`codigoPedido-AAAAMMDD-HH-MM-DESTINO-CANTIDAD-IDCLIENTE`

Ejemplo:

`000000001-20260102-00-47-SUAA-002-0032535`

Interpretación:

- `000000001`: código del pedido,
- `20260102`: fecha,
- `00`: hora,
- `47`: minuto,
- `SUAA`: aeropuerto destino,
- `002`: cantidad,
- `0032535`: cliente.

### 6.3 Proceso backend

El endpoint:

- `POST /api/db/shipments/import-txt`

hace lo siguiente:

1. extrae el origen desde el nombre del archivo,
2. valida que el aeropuerto origen exista,
3. lee cada línea,
4. valida formato y aeropuerto destino,
5. convierte fecha/hora a `LocalDateTime`,
6. recalcula `ingresoUtc`, `gmtOffset` y `slaHoras`,
7. inserta o actualiza el envío,
8. dispara `replanNow("SHIPMENT_IMPORT", "txt masivo")` si hubo cambios.

## 7. Cancelación de vuelos

La replanificación por cancelación ahora es condicional.

Regla:

- si la fecha cancelada es futura, replanifica,
- si la fecha es hoy, replanifica solo si la hora de salida todavía no pasó,
- si la fecha ya pasó, no replanifica porque no afecta el presente.

Eso evita recalcular por vuelos que ya salieron.

## 8. Por qué antes había saltos en el mapa

El problema venía de mezclar dos modelos:

- simulación: tiempo escalado,
- operación diaria: tiempo real.

La pantalla de operación diaria estaba heredando comportamiento temporal de simulación, lo que producía:

- pequeños saltos,
- avance no lineal,
- cambios bruscos de posición.

La corrección fue separar el tiempo de operación diaria:

- usar minuto real del sistema,
- no extrapolar desde el backend,
- no aplicar velocidad de simulación.

## 9. Logging técnico

Se agregaron logs para depuración en:

- `DailyPlanningService`
- `DailyOperationService`
- `ShipmentCrudController`
- `FlightCancellationController`
- `DailyOperationPage`
- `ShipmentsCrud`

Qué buscar:

- `shipments selected for planning=...`
- `flight plans loaded=...`
- `planning result=...`
- `segments built=...`
- `replan triggered ...`
- `upload/import finished ...`

## 10. Secuencia recomendada de validación

1. crear un aeropuerto origen y destino válidos,
2. crear vuelos asociados,
3. subir un TXT de envíos con el nombre estándar,
4. confirmar que se insertan envíos en BD,
5. confirmar que se genera `daily_plan_run`,
6. verificar que aparecen segmentos en el mapa,
7. cancelar un vuelo futuro y verificar replan,
8. observar que la aeronave avanza sin saltos.

## 11. Archivos clave

- `frontend_tasf_b2b/src/pages/DailyOperationPage.tsx`
- `frontend_tasf_b2b/src/components/MapView.tsx`
- `frontend_tasf_b2b/src/components/ShipmentsCrud.tsx`
- `frontend_tasf_b2b/src/components/FlightsCrud.tsx`
- `frontend_tasf_b2b/src/components/AirportsCrud.tsx`
- `frontend_tasf_b2b/src/services/api.ts`
- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/sim/DailyPlanningService.java`
- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/sim/DailyOperationService.java`
- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/ShipmentCrudController.java`
- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/FlightCancellationController.java`
- `backend_tasf_b2b/algoritmos/src/main/java/com/tasf_b2b/planificador/api/ws/DailyOperationStreamRegistry.java`

