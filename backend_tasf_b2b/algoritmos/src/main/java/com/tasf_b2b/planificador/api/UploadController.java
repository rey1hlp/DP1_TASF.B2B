package com.tasf_b2b.planificador.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {
    @PostMapping("/envios")
    public ResponseEntity<Map<String, String>> uploadEnvios(@RequestParam("files") MultipartFile[] files) throws IOException {
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest().build();
        }
        String folderId = UUID.randomUUID().toString();
        Path baseDir = Path.of(System.getProperty("user.dir"), "data", "_uploads", folderId);
        Files.createDirectories(baseDir);

        for (MultipartFile file : files) {
            if (file.isEmpty()) {
                continue;
            }
            String name = file.getOriginalFilename();
            if (name == null || !name.toLowerCase().endsWith(".txt")) {
                continue;
            }
            Path target = baseDir.resolve(Path.of(name).getFileName().toString());
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        }

        Map<String, String> response = new HashMap<>();
        response.put("enviosKey", "_uploads/" + folderId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/envios")
    public ResponseEntity<Void> deleteEnvios(@RequestParam("key") String key) throws IOException {
        if (key == null || key.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        Path baseDir = Path.of(System.getProperty("user.dir"), "data").toAbsolutePath().normalize();
        Path target = baseDir.resolve(key).normalize();

        if (!target.startsWith(baseDir)) {
            return ResponseEntity.badRequest().build();
        }

        if (!Files.exists(target)) {
            return ResponseEntity.noContent().build();
        }

        try (var stream = Files.walk(target)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                }
            });
        }

        return ResponseEntity.noContent().build();
    }
}
