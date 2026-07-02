package com.tasf_b2b.planificador.auth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tasf_b2b.planificador.persistence.AppUserEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class JwtService {
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secretBytes;
    private final long expirationSeconds;

    public JwtService(
        ObjectMapper objectMapper,
        @Value("${tasf.auth.jwt-secret}") String secret,
        @Value("${tasf.auth.jwt-expiration-minutes:480}") long expirationMinutes
    ) {
        this.objectMapper = objectMapper;
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.expirationSeconds = Math.max(1, expirationMinutes) * 60L;
    }

    public String generateToken(AppUserEntity user) {
        Instant now = Instant.now();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "HS256");
        header.put("typ", "JWT");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", user.email);
        payload.put("userId", user.id);
        payload.put("email", user.email);
        payload.put("role", user.role.name());
        payload.put("airportId", user.airport != null ? user.airport.id : null);
        payload.put("airportCode", user.airport != null ? user.airport.codigoOaci : null);
        payload.put("iat", now.getEpochSecond());
        payload.put("exp", now.plusSeconds(expirationSeconds).getEpochSecond());

        String headerPart = encodeJson(header);
        String payloadPart = encodeJson(payload);
        String signaturePart = sign(headerPart + "." + payloadPart);
        return headerPart + "." + payloadPart + "." + signaturePart;
    }

    public Optional<JwtClaims> parseAndValidate(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }
            String signedContent = parts[0] + "." + parts[1];
            byte[] expected = signBytes(signedContent);
            byte[] actual = URL_DECODER.decode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) {
                return Optional.empty();
            }

            Map<String, Object> payload = objectMapper.readValue(
                URL_DECODER.decode(parts[1]),
                new TypeReference<Map<String, Object>>() {}
            );
            long exp = asLong(payload.get("exp"));
            if (exp <= Instant.now().getEpochSecond()) {
                return Optional.empty();
            }

            String email = asString(payload.get("email"));
            Long userId = asNullableLong(payload.get("userId"));
            if (email == null || userId == null) {
                return Optional.empty();
            }
            return Optional.of(new JwtClaims(userId, email));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    public long expirationSeconds() {
        return expirationSeconds;
    }

    private String encodeJson(Map<String, Object> value) {
        try {
            return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not encode JWT", ex);
        }
    }

    private String sign(String content) {
        return URL_ENCODER.encodeToString(signBytes(content));
    }

    private byte[] signBytes(String content) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secretBytes, HMAC_ALGORITHM));
            return mac.doFinal(content.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not sign JWT", ex);
        }
    }

    private static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    private static long asLong(Object value) {
        Long result = asNullableLong(value);
        return result != null ? result : 0L;
    }

    private static Long asNullableLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    public record JwtClaims(Long userId, String email) {
    }
}
