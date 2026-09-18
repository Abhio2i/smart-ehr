package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimItem;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Slf4j
public class PdfReceiptGeneratorService {

    public byte[] generatePaymentReceiptPdf(
            Claim claim,
            String patientName,
            String facilityCode,
            String providerBillingNumber,
            List<ClaimItem> hcItems,
            String paymentMethod,
            String transactionRef,
            double amountPaid
    ) {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font fontRegular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                float y = 740;
                float startX = 40;

                // --- HEADER BANNER ---
                setFillRgb(cs, 26, 60, 143); // #1A3C8F Deep Blue
                cs.addRect(startX, y - 10, 532, 45);
                cs.fill();

                cs.beginText();
                cs.setFont(fontBold, 16);
                setFillRgb(cs, 255, 255, 255);
                cs.newLineAtOffset(startX + 15, y + 15);
                cs.showText("Smart-eHR Billing Portal — Official Payment Receipt");
                cs.endText();

                cs.beginText();
                cs.setFont(fontRegular, 9);
                setFillRgb(cs, 220, 230, 255);
                cs.newLineAtOffset(startX + 15, y + 0);
                cs.showText("GNWT Dept of Health & Social Services | Finance & Billing Division");
                cs.endText();

                y -= 45;

                // --- STATUS BADGE ---
                setFillRgb(cs, 236, 253, 245); // Light Mint
                cs.addRect(startX, y - 20, 532, 25);
                cs.fill();
                setStrokeRgb(cs, 167, 243, 208);
                cs.addRect(startX, y - 20, 532, 25);
                cs.stroke();

                cs.beginText();
                cs.setFont(fontBold, 11);
                setFillRgb(cs, 5, 150, 105); // Emerald Green
                cs.newLineAtOffset(startX + 15, y - 12);
                cs.showText("CONFIRMED & SETTLED — INVOICE #" + (claim != null && claim.getClaimNumber() != null ? claim.getClaimNumber() : "CLM-PAYMENT"));
                cs.endText();

                y -= 45;

                // --- PATIENT & FACILITY DETAILS ---
                cs.beginText();
                cs.setFont(fontBold, 12);
                setFillRgb(cs, 15, 23, 42);
                cs.newLineAtOffset(startX, y);
                cs.showText("1. Patient & Healthcare Facility Information");
                cs.endText();

                y -= 18;
                cs.setFont(fontRegular, 10);
                setFillRgb(cs, 51, 65, 85);

                String pId = claim != null && claim.getPatientId() != null ? claim.getPatientId() : "PAT-REF";
                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Patient Reference: ", patientName + " (" + pId + ")");
                y -= 15;
                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Healthcare Clinic/Facility: ", facilityCode != null ? facilityCode : "General Medical Facility");
                y -= 15;
                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Provider Billing #: ", providerBillingNumber != null ? providerBillingNumber : "PRIMARY-CARE-PROVIDER");

                y -= 30;

                // --- TRANSACTION SUMMARY ---
                cs.beginText();
                cs.setFont(fontBold, 12);
                setFillRgb(cs, 15, 23, 42);
                cs.newLineAtOffset(startX, y);
                cs.showText("2. Payment Transaction Summary");
                cs.endText();

                y -= 18;
                String txnRefStr = transactionRef != null ? transactionRef : ("TXN-" + System.currentTimeMillis());
                String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Date & Time: ", dateStr);
                y -= 15;
                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Razorpay / Transaction Ref: ", txnRefStr);
                y -= 15;
                drawTextLine(cs, fontBold, fontRegular, startX + 10, y, "Payment Method: ", paymentMethod != null ? paymentMethod.toUpperCase() : "RAZORPAY ONLINE");

                y -= 35;

                // --- ITEMIZATION TABLE ---
                cs.beginText();
                cs.setFont(fontBold, 12);
                setFillRgb(cs, 15, 23, 42);
                cs.newLineAtOffset(startX, y);
                cs.showText("3. Settled Services Itemization");
                cs.endText();

                y -= 20;

                // Table Header
                setFillRgb(cs, 241, 245, 249);
                cs.addRect(startX, y - 15, 532, 20);
                cs.fill();

                cs.beginText();
                cs.setFont(fontBold, 9);
                setFillRgb(cs, 51, 65, 85);
                cs.newLineAtOffset(startX + 10, y - 10);
                cs.showText("CODE");
                cs.newLineAtOffset(80, 0);
                cs.showText("DESCRIPTION");
                cs.newLineAtOffset(260, 0);
                cs.showText("QTY");
                cs.newLineAtOffset(60, 0);
                cs.showText("UNIT RATE");
                cs.newLineAtOffset(70, 0);
                cs.showText("TOTAL (INR)");
                cs.endText();

                y -= 20;

                boolean hasItems = false;
                if (claim != null && claim.getLineItems() != null && !claim.getLineItems().isEmpty()) {
                    for (var item : claim.getLineItems()) {
                        hasItems = true;
                        double unit = item.getUnitCharge() != null ? item.getUnitCharge().doubleValue() : 0.0;
                        double total = item.getLineTotal() != null ? item.getLineTotal().doubleValue() : (unit * item.getQuantity());

                        drawTableRow(cs, fontRegular, startX, y,
                                item.getCptOrHcpcsCode() != null ? item.getCptOrHcpcsCode() : "PROC",
                                item.getDescription() != null ? item.getDescription() : "Medical Service",
                                String.valueOf(item.getQuantity()),
                                String.format("%.2f", unit),
                                String.format("%.2f", total));
                        y -= 18;
                    }
                } else if (hcItems != null && !hcItems.isEmpty()) {
                    for (var item : hcItems) {
                        hasItems = true;
                        double unit = item.getUnitPrice() != null ? item.getUnitPrice() : 0.0;
                        double total = item.getTotal() != null ? item.getTotal() : (unit * (item.getQuantity() != null ? item.getQuantity() : 1));

                        drawTableRow(cs, fontRegular, startX, y,
                                item.getServiceCode() != null ? item.getServiceCode() : "PROC",
                                item.getDescription() != null ? item.getDescription() : "Clinical Procedure",
                                String.valueOf(item.getQuantity() != null ? item.getQuantity() : 1),
                                String.format("%.2f", unit),
                                String.format("%.2f", total));
                        y -= 18;
                    }
                }

                if (!hasItems) {
                    drawTableRow(cs, fontRegular, startX, y, "GENERAL", "Standard Emergency Care & Service Invoice", "1", String.format("%.2f", amountPaid), String.format("%.2f", amountPaid));
                    y -= 18;
                }

                y -= 25;

                // --- GRAND TOTAL BOX ---
                setFillRgb(cs, 240, 253, 244);
                cs.addRect(startX + 280, y - 25, 252, 35);
                cs.fill();
                setStrokeRgb(cs, 5, 150, 105);
                cs.addRect(startX + 280, y - 25, 252, 35);
                cs.stroke();

                cs.beginText();
                cs.setFont(fontBold, 10);
                setFillRgb(cs, 4, 120, 87);
                cs.newLineAtOffset(startX + 295, y - 5);
                cs.showText("TOTAL AMOUNT PAID:");
                cs.endText();

                cs.beginText();
                cs.setFont(fontBold, 14);
                setFillRgb(cs, 6, 95, 70);
                cs.newLineAtOffset(startX + 295, y - 20);
                cs.showText("INR " + String.format("%.2f", amountPaid));
                cs.endText();

                // --- FOOTER ---
                cs.beginText();
                cs.setFont(fontRegular, 8);
                setFillRgb(cs, 100, 116, 139);
                cs.newLineAtOffset(startX, 40);
                cs.showText("Note: This is an officially generated computer tax invoice. No physical signature required.");
                cs.newLineAtOffset(0, -12);
                cs.showText("Smart-eHR Platform — HIPAA & Personal Health Information Data Privacy Compliant.");
                cs.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to generate PDF payment receipt: {}", e.getMessage(), e);
            return null;
        }
    }

    private void setFillRgb(PDPageContentStream cs, int r, int g, int b) throws Exception {
        cs.setNonStrokingColor(r / 255.0f, g / 255.0f, b / 255.0f);
    }

    private void setStrokeRgb(PDPageContentStream cs, int r, int g, int b) throws Exception {
        cs.setStrokingColor(r / 255.0f, g / 255.0f, b / 255.0f);
    }

    private void drawTextLine(PDPageContentStream cs, PDType1Font bold, PDType1Font regular, float x, float y, String label, String val) throws Exception {
        cs.beginText();
        cs.setFont(bold, 9);
        cs.newLineAtOffset(x, y);
        cs.showText(label);
        cs.setFont(regular, 9);
        cs.showText(val);
        cs.endText();
    }

    private void drawTableRow(PDPageContentStream cs, PDType1Font font, float startX, float y, String code, String desc, String qty, String rate, String total) throws Exception {
        cs.beginText();
        cs.setFont(font, 8);
        setFillRgb(cs, 30, 41, 59);
        cs.newLineAtOffset(startX + 10, y);
        cs.showText(code != null && code.length() > 14 ? code.substring(0, 14) : (code != null ? code : ""));
        cs.newLineAtOffset(80, 0);
        cs.showText(desc != null && desc.length() > 42 ? desc.substring(0, 42) : (desc != null ? desc : ""));
        cs.newLineAtOffset(260, 0);
        cs.showText(qty != null ? qty : "1");
        cs.newLineAtOffset(60, 0);
        cs.showText(rate != null ? rate : "0.00");
        cs.newLineAtOffset(70, 0);
        cs.showText(total != null ? total : "0.00");
        cs.endText();
    }
}
