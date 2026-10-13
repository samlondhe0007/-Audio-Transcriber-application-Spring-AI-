# Audio Transcriber - full project (Spring Boot + Spring AI + React)

Backend and frontend in ONE project. Spring Boot serves the React page itself.

1. Get a free key at https://console.groq.com  (starts with gsk_)
2. Open src/main/resources/application.properties
3. Replace PASTE_YOUR_GROQ_KEY_HERE with your key
4. Run AudioTranscriberApplication  (or: mvn spring-boot:run)
5. Open http://localhost:8080

Frontend files: src/main/resources/static/ (index.html, App.jsx, App.css).
React is loaded from a CDN, so you need an internet connection (you need one for Groq anyway).
