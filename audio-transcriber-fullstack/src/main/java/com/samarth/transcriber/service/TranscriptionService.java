package com.samarth.transcriber.service;

import org.springframework.ai.audio.transcription.AudioTranscriptionPrompt;
import org.springframework.ai.audio.transcription.AudioTranscriptionResponse;
import org.springframework.ai.openai.OpenAiAudioTranscriptionModel;
import org.springframework.ai.openai.OpenAiAudioTranscriptionOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;

@Service
public class TranscriptionService {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac");

    private final OpenAiAudioTranscriptionModel transcriptionModel;
    private final String modelName;
    private final String apiKey;

    public TranscriptionService(
            OpenAiAudioTranscriptionModel transcriptionModel,
            @Value("${spring.ai.openai.audio.transcription.options.model}") String modelName,
            @Value("${spring.ai.openai.api-key}") String apiKey,
            @Value("${spring.ai.openai.base-url}") String baseUrl) {
        this.transcriptionModel = transcriptionModel;
        this.modelName = modelName.trim();
        this.apiKey = apiKey.trim();
        // Printed once at startup so you can confirm the URL being used
        System.out.println(">>> Transcription base URL: " + baseUrl.trim() + " | model: " + this.modelName);
    }

    public String transcribe(MultipartFile file, String language) throws IOException {
        if (apiKey.isEmpty() || apiKey.startsWith("PASTE")) {
            throw new IllegalArgumentException(
                    "Groq API key is not set. Paste it in application.properties (spring.ai.openai.api-key) and restart.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please choose an audio file.");
        }

        final String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio.mp3";
        String ext = filename.contains(".")
                ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase()
                : "";
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Unsupported format. Allowed: " + ALLOWED_EXTENSIONS);
        }

        // The resource must expose a filename so the audio format can be detected
        ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return filename;
            }
        };

        OpenAiAudioTranscriptionOptions.Builder options = OpenAiAudioTranscriptionOptions.builder()
                .model(modelName)
                .temperature(0f);
        if (language != null && !language.isBlank()) {
            options.language(language.trim());
        }

        AudioTranscriptionResponse response =
                transcriptionModel.call(new AudioTranscriptionPrompt(resource, options.build()));

        return response.getResult().getOutput();
    }
}
