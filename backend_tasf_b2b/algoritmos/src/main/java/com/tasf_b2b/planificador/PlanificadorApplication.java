package com.tasf_b2b.planificador;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.tasf_b2b.planificador")
public class PlanificadorApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlanificadorApplication.class, args);
    }
}
