package com.samarth.transcriber.controller;

import com.samarth.transcriber.service.TranscriptionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/transcribe")
public class TranscriptionController {

    private final TranscriptionService service;

    public TranscriptionController(TranscriptionService service) {
        this.service = service;
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> transcribe(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "language", required = false) String language) throws IOException {

        String text = service.transcribe(file, language);
        return ResponseEntity.ok(Map.of("transcript", text));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    // Errors returned by Groq (wrong key, rate limit, etc.) are shown as-is on the page
    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, String>> groqError(RestClientResponseException ex) {
        String msg = "Groq error " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString();
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> failed(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", String.valueOf(ex.getMessage())));
    }
}
