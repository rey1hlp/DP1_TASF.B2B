# Contexto del Proyecto Tasf.B2B - Planificador

## 🚨 REGLAS DE COSTO - VIOLAR ESTO = $0.50 DE MULTA

1. **PROHIBIDO Read, Grep, Glob, Search** sin que yo escriba exactamente: "LEE archivo.java"
2. **Si pido ver código**: Usa `Bash` con `sed -n '50,55p' archivo.java`. NO uses `Read`.
3. **Si pido buscar**: Di "Dime la ruta exacta del archivo" y espera. NO busques tú.
4. **Límite duro**: 0 archivos leídos por defecto. Solo lees si te doy ruta + líneas exactas.
5. **Salida**: Máximo 10 palabras por respuesta a menos que pida "explica".
6. **Modelo**: Si detectas Fable/Opus activo, responde SOLO: "Estás en Opus, cuesta 5x. Ejecuta /model sonnet" y para.

## ANTES DE RESPONDER CUALQUIER COSA
Si es la primera interacción del chat, di ÚNICAMENTE "Listo." y espera. No saludes, no resumas.

## Stack Tecnológico
- **Lenguaje**: Java 17
- **Framework**: Spring Boot 4.0.5
- **Algoritmos**: GA y ACO
- **DB**: MySQL 8
- **Build**: Maven

## Archivos Críticos - Solo leer si doy ruta exacta
| Archivo | Para qué |
| --- | --- |
| `SimulationService.java` | Velocidad de simulación, DEFAULT_SPEED_MIN_PER_SEC línea 55 |
| `SimulationRegistry.java` | TICK_MS línea 23, bucle de tiempo |
| `Individuo.java` | Cálculo de fitness GA |
| `Ruta.java` | Lógica ACO |

## PROHIBIDO LEER SIEMPRE
`target/`, `.mvn/`, `*.class`, `application.properties`, `pom.xml` a menos que escriba "LEE pom.xml completo"

## Comandos Baratos
- Ver línea: `sed -n '55p' src/.../SimulationService.java`
- Cambiar línea: `sed -i '55s/20.0/30.0/' src/.../SimulationService.java`
- Compilar: `./mvnw clean compile`

## Sesión Actual: 10/06/2026
**Objetivo**: Cambiar velocidad simulación
**Estado**: DEFAULT_SPEED_MIN_PER_SEC = 20.0 en línea 55 de SimulationService.java
**No leer**: Ningún archivo sin orden directa.