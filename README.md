# 🌡️ Gemelo Digital - Sensor de Temperatura con Filtro de Kalman

Simulador interactivo en 3D de un sensor RTD-PT100 con implementación del Filtro de Kalman para estimación óptima de temperatura.

## ✨ Características

- 🎨 **Modelo 3D interactivo** del sensor con rotación y zoom
- 🔬 **Filtro de Kalman** completo para reducción de ruido
- 📊 **Gráficas en tiempo real** comparando valores reales, mediciones y estimaciones
- 📋 **Tabla detallada** con todos los cálculos del filtro
- 💾 **Exportación a CSV** de todos los datos
- ⚙️ **Parámetros ajustables**: temperatura, ruido, tiempo de respuesta

## 🚀 Uso Rápido

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/gemelo-digital-sensor.git
```

2. Abre `index.html` directamente en tu navegador (no requiere servidor).

## 📖 Cómo Funciona

### Simulación del Sensor
El sensor simula un RTD-PT100 real con:
- Respuesta dinámica (filtro de primer orden)
- Ruido gaussiano configurable
- Deriva temporal (0.001°C/hora)
- Rango: -40°C a 150°C

### Filtro de Kalman

**Inicialización:**
- x̂₀ = 10°C (estimación inicial)
- P₀ = 10000.0001 (incertidumbre inicial)
- q = 0.0001 (ruido del proceso)
- r = 0.01 (varianza de medición)

**Tres pasos por iteración:**

1. **Medición**: Captura valor Zₙ del sensor
2. **Actualización**: 
   - K = P/(P + r) ← Ganancia de Kalman
   - x̂ = x̂ + K(z - x̂) ← Estimación mejorada
   - P = (1 - K) × P ← Incertidumbre actualizada
3. **Predicción**:
   - x̂[n+1] = x̂[n] ← Predicción siguiente estado
   - P[n+1] = P[n] + q ← Extrapolar incertidumbre

### Controles Principales

| Botón | Función |
|-------|---------|
| 📊 Iniciar Medición | Toma mediciones cada 5s sin filtro |
| 🔬 Filtro Kalman | Toma mediciones con estimación Kalman |
| 📋 Ver Tabla | Muestra todos los cálculos |
| 💾 Exportar | Descarga datos en CSV |
| 🔧 Calibrar | Ajusta offset del sensor |

### Interacción 3D
- **Rotar**: Arrastra con el mouse
- **Zoom**: Rueda del mouse
- El color del sensor cambia según la temperatura

## 📊 Datos Exportados

El CSV incluye:
- Iteración y tiempo
- Temperatura real vs medida
- Ganancia de Kalman (K)
- Estimación (x̂) e incertidumbre (P)
- Errores de medición y estimación

## 🛠️ Tecnologías

- **Three.js r128** - Renderizado 3D
- **Chart.js 3.9.1** - Gráficas
- **JavaScript ES6+** - Lógica y algoritmos

## 📝 Licencia

MIT License - Uso libre con atribución

## 👤 Autor

[Abdulgane] - [ariasqz13canal@gmail.com]

---

⭐ Si te gusta el proyecto, dale una estrella en GitHub
