package com.tasf_b2b.planificador.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class AppUserConstraintFixer {
    private static final Logger log = LoggerFactory.getLogger(AppUserConstraintFixer.class);

    private final JdbcTemplate jdbcTemplate;

    public AppUserConstraintFixer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureConstraints() {
        if (!tableExists("app_user")) {
            log.warn("[DB_FIX] app_user table does not exist yet, skipping constraint fix");
            return;
        }

        ensureConstraint(
            "chk_app_user_role",
            "CHECK (role IN ('ADMIN', 'LOGISTICS', 'REGISTER'))"
        );
        ensureConstraint(
            "chk_app_user_airport_scope",
            "CHECK ((role = 'ADMIN' AND airport_id IS NULL) OR (role IN ('LOGISTICS', 'REGISTER') AND airport_id IS NOT NULL))"
        );
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Integer.class,
            tableName
        );
        return count != null && count > 0;
    }

    private void ensureConstraint(String constraintName, String desiredClause) {
        String currentClause = jdbcTemplate.query(
            """
            SELECT check_clause
            FROM information_schema.check_constraints
            WHERE constraint_schema = DATABASE()
              AND constraint_name = ?
            """,
            rs -> rs.next() ? rs.getString(1) : null,
            constraintName
        );

        String normalizedCurrent = normalizeClause(currentClause);
        String normalizedDesired = normalizeClause(desiredClause);
        if (Objects.equals(normalizedCurrent, normalizedDesired)) {
            log.info("[DB_FIX] constraint {} already aligned", constraintName);
            return;
        }

        log.info("[DB_FIX] rebuilding constraint {} current={} desired={}", constraintName, currentClause, desiredClause);
        dropConstraintIfExists(constraintName);
        jdbcTemplate.execute("ALTER TABLE app_user ADD CONSTRAINT " + constraintName + " " + desiredClause);
    }

    private void dropConstraintIfExists(String constraintName) {
        Integer count = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
              AND table_name = 'app_user'
              AND constraint_name = ?
            """,
            Integer.class,
            constraintName
        );
        if (count != null && count > 0) {
            jdbcTemplate.execute("ALTER TABLE app_user DROP CONSTRAINT " + constraintName);
        }
    }

    private String normalizeClause(String clause) {
        if (clause == null) {
            return null;
        }
        return clause.replaceAll("\\s+", " ").trim().toUpperCase();
    }
}
