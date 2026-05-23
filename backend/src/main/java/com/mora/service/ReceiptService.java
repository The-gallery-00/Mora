package com.mora.service;

import com.mora.dto.api.ServiceResult;
import com.mora.dto.receipt.ReceiptItemRequest;
import com.mora.dto.receipt.ReceiptResponse;
import com.mora.dto.receipt.ReceiptSaveRequest;
import com.mora.entity.Receipt;
import com.mora.entity.ReceiptItem;
import com.mora.repository.ReceiptRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ReceiptService {

    private static final List<DateTimeFormatter> DATE_FORMATTERS_WITH_YEAR = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy.MM.dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy년 M월 d일")
    );

    private final ReceiptRepository receiptRepository;

    public ReceiptService(ReceiptRepository receiptRepository) {
        this.receiptRepository = receiptRepository;
    }

    @Transactional
    public ServiceResult<ReceiptResponse> save(UUID userId, ReceiptSaveRequest request) {
        String rawTextJoined = joinRawText(request.getRawText());

        Receipt receipt = new Receipt();
        receipt.setUserId(userId);
        receipt.setDocType(defaultIfBlank(request.getDocType(), "RECEIPT"));
        applyFields(receipt, request);
        receipt.setRawText(rawTextJoined);
        receipt.setParsedJson(request.getParsedJson());
        receipt.setRawJson(request.getRawJson());
        receipt.replaceItems(toItems(request.getItems()));

        ReceiptResponse response = ReceiptResponse.from(receiptRepository.save(receipt));
        return ServiceResult.ok(response);
    }

    public ReceiptResponse findById(UUID userId, Integer receiptId) {
        Receipt receipt = receiptRepository.findByIdAndUserId(receiptId, userId)
                .orElseThrow(() -> new RuntimeException("Receipt not found or unauthorized"));
        return ReceiptResponse.from(receipt);
    }

    public Page<ReceiptResponse> listByUser(UUID userId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return receiptRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(ReceiptResponse::from);
    }

    @Transactional
    public ServiceResult<ReceiptResponse> update(UUID userId, Integer receiptId, ReceiptSaveRequest request) {
        Receipt receipt = receiptRepository.findByIdAndUserId(receiptId, userId)
                .orElseThrow(() -> new RuntimeException("Receipt not found or unauthorized"));

        if (request.getDocType() != null) receipt.setDocType(defaultIfBlank(request.getDocType(), "RECEIPT"));
        applyFields(receipt, request);
        if (request.getParsedJson() != null) receipt.setParsedJson(request.getParsedJson());
        if (request.getRawJson() != null) receipt.setRawJson(request.getRawJson());
        if (request.getItems() != null) receipt.replaceItems(toItems(request.getItems()));

        if (request.getRawText() != null && !request.getRawText().isEmpty()) {
            String rawTextJoined = joinRawText(request.getRawText());
            receipt.setRawText(rawTextJoined);
        }

        ReceiptResponse response = ReceiptResponse.from(receiptRepository.save(receipt));
        return ServiceResult.ok(response);
    }

    @Transactional
    public void delete(UUID userId, Integer receiptId) {
        Receipt receipt = receiptRepository.findByIdAndUserId(receiptId, userId)
                .orElseThrow(() -> new RuntimeException("Receipt not found or unauthorized"));
        receiptRepository.delete(receipt);
    }

    private void applyFields(Receipt receipt, ReceiptSaveRequest request) {
        if (request.getClassificationConfidence() != null) receipt.setClassificationConfidence(request.getClassificationConfidence());
        if (request.getMerchantName() != null) receipt.setMerchantName(request.getMerchantName());
        if (request.getMerchantAddress() != null) receipt.setMerchantAddress(request.getMerchantAddress());
        if (request.getPurchaseDate() != null) receipt.setPurchaseDate(parseDate(request.getPurchaseDate()));
        if (request.getPurchaseTime() != null) receipt.setPurchaseTime(parseTime(request.getPurchaseTime()));
        if (request.getPaymentMethod() != null) receipt.setPaymentMethod(request.getPaymentMethod());
        if (request.getCardCompany() != null) receipt.setCardCompany(request.getCardCompany());
        if (request.getTotalAmount() != null) receipt.setTotalAmount(request.getTotalAmount());
        if (request.getCurrencyCode() != null) receipt.setCurrencyCode(defaultIfBlank(request.getCurrencyCode(), "KRW"));
    }

    private List<ReceiptItem> toItems(List<ReceiptItemRequest> requests) {
        if (requests == null) return List.of();
        return requests.stream()
                .filter(item -> item.getItemName() != null && !item.getItemName().isBlank())
                .map(this::toItem)
                .toList();
    }

    private ReceiptItem toItem(ReceiptItemRequest request) {
        ReceiptItem item = new ReceiptItem();
        item.setItemName(request.getItemName());
        item.setQuantity(request.getQuantity());
        item.setUnitPrice(request.getUnitPrice());
        item.setTotalPrice(request.getTotalPrice());
        item.setCategory(request.getCategory());
        return item;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        String cleaned = dateStr.replaceAll("\\([^)]*\\)", "").trim();

        for (DateTimeFormatter formatter : DATE_FORMATTERS_WITH_YEAR) {
            try {
                return LocalDate.parse(cleaned, formatter);
            } catch (Exception ignored) {
            }
        }

        try {
            if (cleaned.matches("\\d{1,2}\\.\\d{1,2}")) {
                String[] parts = cleaned.split("\\.");
                return LocalDate.of(LocalDate.now().getYear(), Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
            }
            if (cleaned.matches("\\d{1,2}월\\s*\\d{1,2}일")) {
                String[] parts = cleaned.replace("일", "").split("월");
                return LocalDate.of(LocalDate.now().getYear(), Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim()));
            }
        } catch (Exception ignored) {
        }

        return null;
    }

    private LocalTime parseTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return null;
        String cleaned = timeStr.trim();

        for (String pattern : List.of("H:mm", "H:mm:ss")) {
            try {
                return LocalTime.parse(cleaned, DateTimeFormatter.ofPattern(pattern));
            } catch (Exception ignored) {
            }
        }

        try {
            String lower = cleaned.toLowerCase(Locale.ROOT);
            boolean isPm = cleaned.contains("오후") || lower.contains("pm");
            boolean isAm = cleaned.contains("오전") || lower.contains("am");
            if (isPm || isAm) {
                String[] parts = cleaned.replaceAll("[^0-9]", " ").trim().split("\\s+");
                int hour = Integer.parseInt(parts[0]);
                int minute = parts.length >= 2 ? Integer.parseInt(parts[1]) : 0;
                if (isPm && hour < 12) hour += 12;
                if (isAm && hour == 12) hour = 0;
                return LocalTime.of(hour, minute);
            }
        } catch (Exception ignored) {
        }

        return null;
    }

    private String joinRawText(List<String> rawTextList) {
        if (rawTextList == null || rawTextList.isEmpty()) return "";
        return String.join(" ", rawTextList);
    }

    private String defaultIfBlank(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
