package com.mora.service;

import com.mora.dto.data.UserDataDeleteResponse;
import com.mora.repository.BusinessCardRepository;
import com.mora.repository.GoogleCalendarEventRepository;
import com.mora.repository.PosterRepository;
import com.mora.repository.ReceiptRepository;
import com.mora.repository.SearchHistoryRepository;
import com.mora.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserDataService {

    private final BusinessCardRepository businessCardRepository;
    private final TicketRepository ticketRepository;
    private final PosterRepository posterRepository;
    private final ReceiptRepository receiptRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final GoogleCalendarEventRepository googleCalendarEventRepository;

    public UserDataService(BusinessCardRepository businessCardRepository,
                           TicketRepository ticketRepository,
                           PosterRepository posterRepository,
                           ReceiptRepository receiptRepository,
                           SearchHistoryRepository searchHistoryRepository,
                           GoogleCalendarEventRepository googleCalendarEventRepository) {
        this.businessCardRepository = businessCardRepository;
        this.ticketRepository = ticketRepository;
        this.posterRepository = posterRepository;
        this.receiptRepository = receiptRepository;
        this.searchHistoryRepository = searchHistoryRepository;
        this.googleCalendarEventRepository = googleCalendarEventRepository;
    }

    @Transactional
    public UserDataDeleteResponse deleteAllDocuments(UUID userId) {
        if (userId == null) {
            throw new RuntimeException("사용자 ID가 필요합니다.");
        }

        long businessCards = businessCardRepository.countByUserId(userId);
        long tickets = ticketRepository.countByUserId(userId);
        long posters = posterRepository.countByUserId(userId);
        long receipts = receiptRepository.countByUserId(userId);
        long histories = searchHistoryRepository.countByUserId(userId);
        long googleCalendarMappings = googleCalendarEventRepository.countByUserId(userId);

        googleCalendarEventRepository.deleteByUserId(userId);
        searchHistoryRepository.deleteByUserId(userId);
        businessCardRepository.deleteByUserId(userId);
        ticketRepository.deleteByUserId(userId);
        posterRepository.deleteByUserId(userId);
        receiptRepository.deleteByUserId(userId);

        return new UserDataDeleteResponse(
                businessCards,
                tickets,
                posters,
                receipts,
                histories,
                googleCalendarMappings
        );
    }
}
