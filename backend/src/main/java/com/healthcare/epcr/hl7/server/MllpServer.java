package com.healthcare.epcr.hl7.server;

import com.healthcare.epcr.hl7.config.Hl7Config;
import com.healthcare.epcr.hl7.service.Hl7MessageProcessor;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class MllpServer {

    // ── Production tunables ───────────────────────────────────────────────────
    private static final int CORE_THREADS           = 10;      // always-alive threads
    private static final int MAX_THREADS            = 50;      // burst capacity
    private static final int QUEUE_CAPACITY         = 200;     // pending-connection queue
    private static final long KEEP_ALIVE_SECONDS    = 60L;     // idle thread TTL
    private static final int CLIENT_READ_TIMEOUT_MS = 30_000;  // 30 s per-connection read timeout

    private final Hl7Config hl7Config;
    private final Hl7MessageProcessor messageProcessor;

    private ServerSocket serverSocket;
    private ExecutorService executorService;

    // volatile: guarantees visibility across the accept-loop thread and @PreDestroy thread
    private volatile boolean running = false;

    public MllpServer(Hl7Config hl7Config, Hl7MessageProcessor messageProcessor) {
        this.hl7Config = hl7Config;
        this.messageProcessor = messageProcessor;
    }

    @PostConstruct
    public void start() {
        if (!hl7Config.isEnabled()) {
            log.info("HL7 MLLP Server is disabled in configuration.");
            return;
        }

        int port = hl7Config.getMllp().getPort();
        log.info("Starting HL7 MLLP Server on port {} (coreThreads={}, maxThreads={}, queue={})...",
                port, CORE_THREADS, MAX_THREADS, QUEUE_CAPACITY);

        // Bounded thread pool — prevents OOM under high connection load
        executorService = new ThreadPoolExecutor(
                CORE_THREADS,
                MAX_THREADS,
                KEEP_ALIVE_SECONDS,
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(QUEUE_CAPACITY),
                r -> {
                    Thread t = new Thread(r, "hl7-mllp-handler");
                    t.setDaemon(true);
                    return t;
                },
                // When queue is full: run in the calling (accept) thread → natural back-pressure
                new ThreadPoolExecutor.CallerRunsPolicy()
        );

        running = true;

        Thread acceptThread = new Thread(() -> {
            try {
                serverSocket = new ServerSocket(port);
                log.info("HL7 MLLP Server successfully bound to port {}.", port);

                while (running) {
                    try {
                        Socket clientSocket = serverSocket.accept();
                        // Per-connection read timeout: prevents idle clients holding threads forever
                        clientSocket.setSoTimeout(CLIENT_READ_TIMEOUT_MS);
                        log.debug("Accepted HL7 connection from: {}", clientSocket.getRemoteSocketAddress());

                        if (!executorService.isShutdown()) {
                            executorService.submit(new MllpHandler(clientSocket, messageProcessor));
                        }
                    } catch (IOException e) {
                        if (!running) {
                            break; // Normal shutdown — not an error
                        }
                        log.error("Error accepting incoming HL7 connection", e);
                    }
                }
            } catch (IOException e) {
                log.error("Failed to bind HL7 MLLP Server to port {}", port, e);
            }
        }, "hl7-mllp-server-thread");

        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    @PreDestroy
    public void stop() {
        log.info("Stopping HL7 MLLP Server...");
        running = false;

        // Close server socket to unblock serverSocket.accept()
        if (serverSocket != null && !serverSocket.isClosed()) {
            try {
                serverSocket.close();
            } catch (IOException e) {
                log.error("Error closing HL7 MLLP server socket", e);
            }
        }

        // Graceful shutdown: let in-flight handlers finish (max 30s), then force-kill
        if (executorService != null) {
            executorService.shutdown();
            try {
                if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                    log.warn("HL7 MLLP handler threads did not finish within 30s — forcing shutdown.");
                    executorService.shutdownNow();
                }
            } catch (InterruptedException e) {
                executorService.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        log.info("HL7 MLLP Server stopped.");
    }
}
