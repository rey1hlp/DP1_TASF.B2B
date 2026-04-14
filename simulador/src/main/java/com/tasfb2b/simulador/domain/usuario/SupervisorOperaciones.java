package com.tasfb2b.simulador.domain.usuario;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "supervisores_operaciones")
public class SupervisorOperaciones extends Usuario {

    public void iniciarSimulacion() {
    }

    public void replanificar() {
    }

    public void verReportes() {
    }
}
