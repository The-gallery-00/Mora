package com.mora.dto.ticket;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class TicketSaveRequest {

    // 문서 유형 (ex. "TICKET")
    private String docType;

    // 문서 분류 신뢰도 (ex. 0.95)
    private BigDecimal classificationConfidence;

    // 운송수단 (ex. KTX, 버스)
    private String transportType;

    private String departureLocation;

    private String departureDate;

    private String departureTime;

    private String arrivalLocation;

    private String arrivalDate;

    private String arrivalTime;

    private List<String> rawText;

    private String parsedJson;

    private String rawJson;

}
