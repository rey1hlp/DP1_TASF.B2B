package com.tasfb2b.simulador.domain.operaciones;

import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import com.tasfb2b.simulador.domain.logistica.Vuelo;

import java.util.List;

public record RedLogistica(List<Aeropuerto> aeropuertos, List<Vuelo> vuelos) {
}
