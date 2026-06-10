# Contexto del Proyecto Tasf.B2B - Planificador

## Reglas de Tokens e Interacción
1. **Lectura Quirúrgica**: NO leas archivos completos. Usa `grep` para encontrar clases o métodos.
2. **Límite de Líneas**: Lee máximo 50-60 líneas por archivo a menos que pida "lee todo el archivo".
3. **Resumen Obligatorio**: Tras leer un archivo, resume su propósito en 1 línea (ej: "Maneja el streaming de snapshots vía WebSockets").
4. **Ignorar**: Nunca leas `target/`, `.mvn/`, ni archivos `.class`.

## Stack Tecnológico
- **Lenguaje**: Java 17
- **Framework**: Spring Boot 4.0.5 (Starter Web, Data JPA, WebSocket)
- **Algoritmos**: Algoritmo Genético (GA) y Ant Colony Optimization (ACO)
- **DB**: MySQL 8 (vía JDBC Template y JPA)
- **Build Tool**: Maven

## Estructura Clave
| Carpeta / Archivo | Contenido | Cuándo leer |
| --- | --- | --- |
| `src/main/java/com/tasf_b2b/planificador/dominio` | Entidades base (Aeropuerto, Envio, Vuelo) | Para lógica de negocio |
| `src/main/java/com/tasf_b2b/planificador/nucleo` | Motores GA y ACO | Para optimizar algoritmos |
| `src/main/java/com/tasf_b2b/planificador/api/ws` | Configuración de WebSockets | Para bugs de tiempo real |
| `db/tasf_b2b_schema.sql` | Esquema de base de datos | Para entender relaciones |
| `data/` | Archivos .txt/.csv de entrada | Para problemas de parsing |

## Flujo de Trabajo (Ahorro de $)
1. **Verificación de Errores**: Antes de proponer un cambio en los algoritmos, revisa `Individuo.java` o `Ruta.java` para no romper el cálculo del fitness.
2. **Consistencia de Unidades**: El sistema usa GMT y cálculos de tiempo en horas/minutos. No mezclar sin revisar el offset.

## Comandos del Proyecto
- `./mvnw clean compile`: Compilar proyecto
- `./mvnw spring-boot:run`: Ejecutar API
- `java -cp target/genetico-0.0.1-SNAPSHOT.jar com.tasf_b2b.planificador.Main ga`: Correr algoritmo genético

## Sesión Actual: 24/05/2024
**Objetivo**: [ESCRIBE AQUÍ TU TAREA DE HOY] (Ej: Optimizar la función de fitness en el Algoritmo Genético)
**Estado**: [PUNTO DE PARTIDA] (Ej: El algoritmo converge muy rápido a soluciones mediocres)
**No leer**: Archivos de base de datos o WebSockets, ya funcionan correctamente.

---
*Nota: Antes de cada sesión, actualiza el Objetivo. Al terminar, marca como DONE.*