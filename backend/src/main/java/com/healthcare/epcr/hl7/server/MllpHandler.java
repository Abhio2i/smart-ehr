package com.healthcare.epcr.hl7.server;

import com.healthcare.epcr.hl7.service.Hl7MessageProcessor;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

@Slf4j
public class MllpHandler implements Runnable {

    private static final byte START_OF_BLOCK = 0x0B;
    private static final byte END_OF_BLOCK = 0x1C;
    private static final byte CARRIAGE_RETURN = 0x0D;

    private final Socket socket;
    private final Hl7MessageProcessor messageProcessor;

    public MllpHandler(Socket socket, Hl7MessageProcessor messageProcessor) {
        this.socket = socket;
        this.messageProcessor = messageProcessor;
    }

    @Override
    public void run() {
        try (socket;
             InputStream in = socket.getInputStream();
             OutputStream out = socket.getOutputStream()) {

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int b;
            boolean inBlock = false;

            while ((b = in.read()) != -1) {
                if (b == START_OF_BLOCK) {
                    inBlock = true;
                    buffer.reset();
                    continue;
                }

                if (b == END_OF_BLOCK) {
                    int next = in.read(); // Read the CR (0x0D) following the 0x1C
                    if (next == CARRIAGE_RETURN) {
                        String rawMessage = buffer.toString("UTF-8");
                        log.debug("Received raw HL7 Message:\n{}", rawMessage);

                        // Process HL7 string and get raw ACK string response
                        String ackResponse = messageProcessor.processMessage(rawMessage);
                        log.info("Sending ACK response back to client (length={}):\n{}", 
                                ackResponse != null ? ackResponse.length() : 0, ackResponse);

                        // Wrap and write ACK in MLLP envelope
                        out.write(START_OF_BLOCK);
                        if (ackResponse != null) {
                            out.write(ackResponse.getBytes("UTF-8"));
                        }
                        out.write(END_OF_BLOCK);
                        out.write(CARRIAGE_RETURN);
                        out.flush();
                    }
                    inBlock = false;
                    buffer.reset();
                } else if (inBlock) {
                    buffer.write(b);
                }
            }
        } catch (java.net.SocketException e) {
            log.info("Client closed connection: {} ({})", socket.getRemoteSocketAddress(), e.getMessage());
        } catch (IOException e) {
            log.error("Error processing MLLP HL7 connection socket: {}", socket.getRemoteSocketAddress(), e);
        }
    }
}
